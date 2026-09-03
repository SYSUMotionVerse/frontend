import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const argumentsByName = {
  manifest: '',
  videos: '',
  out: ''
}

for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index]
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2)
  if (key in argumentsByName) argumentsByName[key] = value
}

if (!argumentsByName.manifest || !argumentsByName.videos || !argumentsByName.out) {
  throw new Error(
    'Usage: node scripts/plan-guidance-tts.mjs --manifest <manifest.json> --videos <exercise-videos.json> --out <plan.json>'
  )
}

function normalizeActionName(value) {
  return value
    .normalize('NFKC')
    .replace(/^\s*\d+\s*[.、．]?\s*/, '')
    .replace(/^(?:热身|自重抗阻ES|自重抗阻|传统武术|传统体育养生动作|拉伸放松|拉伸)\s*[:：]?\s*/i, '')
    .replace(/[“”"'‘’]/g, '')
    .replace(/[＋+]/g, '')
    .replace(/加/g, '')
    .replace(/[、，,：:（）()\s]/g, '')
    .toLowerCase()
}

function targetSequence(title) {
  const match = title.match(/^\s*(\d+)\s*[.、．]/)
  return match ? Number(match[1]) : NaN
}

function actionPrefix(standardDataUrl) {
  const parsed = new URL(standardDataUrl)
  const match = parsed.pathname.match(/^\/actions\/([0-9a-f-]{36})\/standard(?:-guidance-tts-v\d+)?\.json$/i)
  if (!match) {
    throw new Error(`Unsupported action standard URL: ${standardDataUrl}`)
  }
  return {
    prefix: `actions/${match[1]}`,
    publicBaseUrl: parsed.origin
  }
}

function mergeCues(cues, offset = 0) {
  const grouped = new Map()
  for (const cue of cues) {
    const time = cue.time - offset
    const texts = grouped.get(time) ?? []
    texts.push(cue.text)
    grouped.set(time, texts)
  }
  return [...grouped.entries()]
    .map(([time, texts]) => ({ time, text: texts.join(' ') }))
    .sort((left, right) => left.time - right.time)
}

function planTrack(tracks, { key, durationSeconds, cues, type }) {
  if (tracks.some(track => track.key === key)) {
    throw new Error(`Duplicate audio track key: ${key}`)
  }
  tracks.push({ key, duration_seconds: durationSeconds, type, cues })
  return key
}

const manifest = JSON.parse(await readFile(resolve(argumentsByName.manifest), 'utf8'))
const videos = JSON.parse(await readFile(resolve(argumentsByName.videos), 'utf8'))

if (!Array.isArray(manifest.actions) || !Array.isArray(videos)) {
  throw new Error('Manifest and video inventory must both contain arrays.')
}

const videosBySequence = new Map()
for (const video of videos) {
  const sequence = targetSequence(video.title ?? '')
  if (!Number.isInteger(sequence)) {
    throw new Error(`Cannot infer action sequence from database title: ${video.title}`)
  }
  const key = `${video.exercise_type}:${sequence}`
  if (videosBySequence.has(key)) {
    throw new Error(`Duplicate database action sequence: ${key}`)
  }
  if (!video.standard_data_url?.trim()) {
    throw new Error(`Action ${key} has no standard_data_url`)
  }
  videosBySequence.set(key, video)
}

const publicBaseUrls = new Set(videos.map(video => actionPrefix(video.standard_data_url).publicBaseUrl))
if (publicBaseUrls.size !== 1) {
  throw new Error('All action standards must use the same public COS origin.')
}

const [publicBaseUrl] = publicBaseUrls
const silentTrackKey = 'shared/tts/guidance-v1/silence-30ms.mp3'
const silentAudioUrl = `${publicBaseUrl}/${silentTrackKey}`
const tracks = [{
  key: silentTrackKey,
  duration_seconds: 0.03,
  type: 'silence',
  cues: []
}]
const updates = []
const differences = []

for (const action of manifest.actions) {
  const key = `${action.exercise_type}:${action.sequence}`
  const video = videosBySequence.get(key)
  if (!video) throw new Error(`No database action found for ${key}`)

  const source = actionPrefix(video.standard_data_url)
  const baseUrl = `${source.publicBaseUrl}/${source.prefix}`
  const activeCues = mergeCues(action.cues.filter(cue => cue.phase === 'active'))
  const restCues = mergeCues(action.cues.filter(cue => cue.phase === 'rest'))
  const timelineCues = action.cues.filter(cue => cue.phase === 'timeline')
  const preparationCues = timelineCues.filter(cue => cue.time < 300)
  const completionCues = timelineCues.filter(cue => cue.time >= 300)

  if (preparationCues.length > 0 && completionCues.length > 0) {
    throw new Error(`Action ${key} mixes preparation and completion timeline cues`)
  }
  if (preparationCues.length > 0 && preparationCues[0].time !== 50) {
    throw new Error(`Unexpected preparation timing for ${key}`)
  }
  if (completionCues.some(cue => cue.time !== 300)) {
    throw new Error(`Unexpected completion timing for ${key}`)
  }

  const ttsCues = activeCues.map((cue, index) => {
    const nextCueTime = activeCues[index + 1]?.time ?? action.duration_seconds
    const durationSeconds = Math.max(0.2, nextCueTime - cue.time - 0.12)
    const audioFileName = `active-${String(index + 1).padStart(2, '0')}.mp3`
    const audioKey = `${source.prefix}/tts/timeline-v1/${audioFileName}`
    planTrack(tracks, {
      key: audioKey,
      durationSeconds,
      cues: [{ time: 0, text: cue.text }],
      type: 'active'
    })
    return {
      time: cue.time,
      text: cue.text,
      audio_url: `${baseUrl}/tts/timeline-v1/${audioFileName}`
    }
  })

  const hasTransitionAudio = restCues.length > 0 || preparationCues.length > 0 || completionCues.length > 0
  const transitionAudioUrls = hasTransitionAudio
    ? { start: silentAudioUrl, end: silentAudioUrl }
    : {}
  if (restCues.length > 0) {
    transitionAudioUrls.rest_next_action = `${baseUrl}/tts/transition-v1/rest-next-action.mp3`
    planTrack(tracks, {
      key: `${source.prefix}/tts/transition-v1/rest-next-action.mp3`,
      durationSeconds: 20,
      cues: restCues,
      type: 'rest'
    })
  }
  if (preparationCues.length > 0) {
    const preparationStart = preparationCues[0].time
    transitionAudioUrls.next_action = `${baseUrl}/tts/transition-v1/next-action.mp3`
    planTrack(tracks, {
      key: `${source.prefix}/tts/transition-v1/next-action.mp3`,
      durationSeconds: 10,
      cues: mergeCues(preparationCues, preparationStart),
      type: 'preparation'
    })
  }
  if (completionCues.length > 0) {
    transitionAudioUrls.end = `${baseUrl}/tts/transition-v1/end.mp3`
    planTrack(tracks, {
      key: `${source.prefix}/tts/transition-v1/end.mp3`,
      durationSeconds: 4,
      cues: mergeCues(completionCues, 300),
      type: 'completion'
    })
  }

  const databaseName = normalizeActionName(video.title)
  const documentName = normalizeActionName(action.action_name)
  if (databaseName !== documentName || video.duration !== action.duration_seconds) {
    differences.push({
      key,
      document_action_name: action.action_name,
      database_title: video.title,
      document_duration_seconds: action.duration_seconds,
      database_duration_seconds: video.duration,
      name_matches: databaseName === documentName
    })
  }

  updates.push({
    key,
    video_id: video.id,
    action_name: action.action_name,
    standard_data_url: video.standard_data_url,
    tts_cues: ttsCues,
    ...(Object.keys(transitionAudioUrls).length > 0
      ? { transition_audio_urls: transitionAudioUrls }
      : {})
  })
}

if (updates.length !== videos.length || updates.length !== manifest.actions.length) {
  throw new Error('The document and database action counts do not match.')
}

const plan = {
  schema_version: 'guidance-tts-plan-v1',
  generated_at: new Date().toISOString(),
  action_count: updates.length,
  track_count: tracks.length,
  tracks,
  updates,
  differences
}

const outputPath = resolve(argumentsByName.out)
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')

console.log(`Wrote ${plan.action_count} action updates and ${plan.track_count} timed tracks to ${outputPath}`)
console.log(`Document/database differences: ${plan.differences.length}`)
for (const difference of plan.differences) {
  console.log(
    `${difference.key}: document=${difference.document_action_name} (${difference.document_duration_seconds}s), `
    + `database=${difference.database_title} (${difference.database_duration_seconds}s)`
  )
}
