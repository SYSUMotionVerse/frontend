import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const options = {
  items: '',
  videos: '',
  out: ''
}

for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index]
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2)
  if (key in options) options[key] = value
}

if (!options.items || !options.videos || !options.out) {
  throw new Error(
    'Usage: node scripts/plan-guidance-countdown-audio.mjs --items <arrangement-items.json> --videos <exercise-videos.json> --out <plan.json>'
  )
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function countdownStandardDetails(standardDataUrl) {
  if (typeof standardDataUrl !== 'string' || !standardDataUrl.trim()) {
    throw new Error('Countdown target is missing standard_data_url.')
  }

  const parsedUrl = new URL(standardDataUrl)
  const match = parsedUrl.pathname.match(/^(.*)\/actions\/([0-9a-f-]{36})\/standard-guidance-tts-v\d+\.json$/i)
  if (!match) {
    throw new Error(`Unsupported guidance standard URL: ${standardDataUrl}`)
  }

  return {
    publicBaseUrl: `${parsedUrl.origin}${match[1]}`.replace(/\/+$/, ''),
    standardDataUrl
  }
}

const [items, videos] = await Promise.all([
  readFile(resolve(options.items), 'utf8').then(JSON.parse),
  readFile(resolve(options.videos), 'utf8').then(JSON.parse)
])

if (!Array.isArray(items) || !Array.isArray(videos)) {
  throw new Error('Items and videos inputs must both contain arrays.')
}

const videosById = new Map()
for (const video of videos) {
  if (!isRecord(video) || !Number.isInteger(video.id)) {
    throw new Error('Video inventory contains an invalid row.')
  }
  if (videosById.has(video.id)) {
    throw new Error(`Video inventory contains duplicate id ${video.id}.`)
  }
  videosById.set(video.id, video)
}

const targetsByVideoId = new Map()
for (const item of items) {
  if (!isRecord(item) || !Number.isInteger(item.exercise_video_id)) {
    throw new Error('Arrangement inventory contains an invalid row.')
  }
  if (!Number.isInteger(item.countdown_duration) || item.countdown_duration < 0) {
    throw new Error(`Arrangement item ${item.id ?? 'unknown'} has an invalid countdown_duration.`)
  }
  if (item.countdown_duration === 0) continue
  if (item.countdown_duration > 3) {
    throw new Error(`Arrangement item ${item.id} requests unsupported ${item.countdown_duration}s countdown.`)
  }

  const video = videosById.get(item.exercise_video_id)
  if (!video || typeof video.standard_data_url !== 'string') {
    throw new Error(`Countdown item ${item.id} has no matching guidance standard.`)
  }
  const details = countdownStandardDetails(video.standard_data_url)
  const existing = targetsByVideoId.get(video.id)
  if (existing && existing.standard_data_url !== details.standardDataUrl) {
    throw new Error(`Video ${video.id} uses conflicting guidance standard URLs.`)
  }
  targetsByVideoId.set(video.id, {
    video_id: video.id,
    standard_data_url: details.standardDataUrl,
    public_base_url: details.publicBaseUrl,
    countdown_duration: item.countdown_duration
  })
}

const targets = [...targetsByVideoId.values()]
if (targets.length === 0) {
  throw new Error('No active arrangement items request a countdown.')
}

const publicBaseUrls = new Set(targets.map(target => target.public_base_url))
if (publicBaseUrls.size !== 1) {
  throw new Error('Countdown targets do not use a single COS public base URL.')
}
const [publicBaseUrl] = publicBaseUrls
const countdownAudioUrls = {
  '3': `${publicBaseUrl}/shared/tts/guidance-v1/countdown-3.mp3`,
  '2': `${publicBaseUrl}/shared/tts/guidance-v1/countdown-2.mp3`,
  '1': `${publicBaseUrl}/shared/tts/guidance-v1/countdown-1.mp3`
}

const plan = {
  schema_version: 'guidance-countdown-audio-plan-v1',
  generated_at: new Date().toISOString(),
  public_base_url: publicBaseUrl,
  track_count: 3,
  standard_update_count: targets.length,
  tracks: [
    {
      key: 'shared/tts/guidance-v1/countdown-3.mp3',
      duration_seconds: 1,
      type: 'countdown',
      cues: [{ time: 0, text: '三' }]
    },
    {
      key: 'shared/tts/guidance-v1/countdown-2.mp3',
      duration_seconds: 1,
      type: 'countdown',
      cues: [{ time: 0, text: '二' }]
    },
    {
      key: 'shared/tts/guidance-v1/countdown-1.mp3',
      duration_seconds: 1,
      type: 'countdown',
      cues: [{ time: 0, text: '一' }]
    }
  ],
  updates: targets
    .sort((left, right) => left.video_id - right.video_id)
    .map(({ public_base_url, ...target }) => ({
      ...target,
      countdown_audio_urls: countdownAudioUrls
    }))
}

const outputPath = resolve(options.out)
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
console.log(`Wrote ${plan.standard_update_count} countdown standard updates to ${outputPath}`)
