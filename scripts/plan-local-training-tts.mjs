import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const options = {
  full: '',
  optimized: '',
  videos: '',
  items: '',
  audio: '',
  optimizedAudio: '',
  out: '',
  optimizedOnly: false
}

for (let index = 2; index < process.argv.length; index += 1) {
  const option = process.argv[index]
  if (option === '--optimized-only') {
    options.optimizedOnly = true
    continue
  }
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2)
  if (key in options && key !== 'optimizedOnly') {
    options[key] = value
    index += 1
  }
}

if (Object.values(options).some(value => !value)) {
  throw new Error(
    'Usage: node scripts/plan-local-training-tts.mjs --full <json> --optimized <json> --videos <json> --items <json> --audio <dir> --optimizedAudio <dir> --out <json>'
  )
}

const [full, optimized, videos, items] = await Promise.all([
  readFile(resolve(options.full), 'utf8').then(JSON.parse),
  readFile(resolve(options.optimized), 'utf8').then(JSON.parse),
  readFile(resolve(options.videos), 'utf8').then(JSON.parse),
  readFile(resolve(options.items), 'utf8').then(JSON.parse)
])

if (!Array.isArray(full) || !Array.isArray(optimized) || !Array.isArray(videos) || !Array.isArray(items)) {
  throw new Error('All source files must contain arrays.')
}

const VOICE = 'zh-CN-XiaoxiaoNeural'
const RATE = '-5%'
const PUBLIC_BASE = 'https://cdn.sysusports.cn'

function safeName(value) {
  return value.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'action'
}

function sequenceFromTitle(title) {
  const match = String(title).match(/^\s*(\d+)\s*[.、．]/)
  return match ? Number(match[1]) : NaN
}

function fingerprint(text) {
  return createHash('sha256')
    .update(`training-tts-v1\0${VOICE}\0${RATE}\0${text.trim()}`)
    .digest('hex')
}

function fullActionDetails(action) {
  const index = Number(action.index)
  if (!Number.isInteger(index) || index < 1 || index > 143) throw new Error(`Invalid full action index: ${action.index}`)
  return index <= 77
    ? { exercise_type: 'MARTIAL_ARTS', sequence: index, localIndex: index, setIndex: action.set_index }
    : { exercise_type: 'HIIT', sequence: index - 77, localIndex: index, setIndex: action.set_index }
}

const fullByKey = new Map(full.map(action => {
  const details = fullActionDetails(action)
  return [`${details.exercise_type}:${details.sequence}`, { action, ...details }]
}))
const optimizedBySequence = new Map(optimized.map(action => {
  const sequence = Number(action.document_number)
  if (!Number.isInteger(sequence)) throw new Error(`Optimized action has no document number: ${action.action_name}`)
  return [sequence, action]
}))
const videosByKey = new Map(videos.map(video => {
  const sequence = sequenceFromTitle(video.title)
  if (!Number.isInteger(sequence)) throw new Error(`Cannot parse video sequence: ${video.title}`)
  return [`${video.exercise_type}:${sequence}`, video]
}))
const itemsByVideoId = new Map(items.map(item => [item.exercise_video_id, item]))

const tracks = new Map()
const updates = []
const mergedOverrides = []

function addCue(action, phase, cue, cueIndex, source, item) {
  const time = Number(cue.time_seconds)
  if (!Number.isInteger(time) || time < 0 || time > 60) throw new Error(`Invalid cue time for ${action.action_name}: ${cue.time_seconds}`)
  const text = String(cue.text ?? '').trim()
  if (!text) throw new Error(`Empty cue text for ${action.action_name}`)
  const actionIndex = source === 'optimized' ? Number(action.document_number) : Number(action.index)
  const setIndex = source === 'optimized' ? 0 : Number(action.set_index)
  const root = source === 'optimized' ? resolve(options.optimizedAudio) : resolve(options.audio)
  const localPath = `${root}/set-${String(setIndex).padStart(2, '0')}/action-${String(actionIndex).padStart(3, '0')}-${safeName(action.action_name)}/${phase.toLowerCase()}-${String(cueIndex + 1).padStart(2, '0')}-at-${String(time).padStart(2, '0')}s.mp3`
  const key = `training-tts/cue/${fingerprint(text)}.mp3`
  if (!tracks.has(key)) tracks.set(key, { key, local_path: localPath, text, voice: VOICE, rate: RATE })
  return {
    phase,
    timing: time === 0 ? 'START' : 'AFTER_OFFSET',
    offset_seconds: time,
    text,
    audio_key: key,
    audio_url: `${PUBLIC_BASE}/${key}`,
    render_fingerprint: fingerprint(text),
    order: cueIndex
  }
}

for (const [key, video] of videosByKey) {
  const sequence = sequenceFromTitle(video.title)
  const optimizedAction = video.exercise_type === 'MARTIAL_ARTS' ? optimizedBySequence.get(sequence) : undefined
  if (options.optimizedOnly && !optimizedAction) continue
  const fullEntry = fullByKey.get(key)
  if (!options.optimizedOnly && !fullEntry) throw new Error(`No full document action for ${key}`)
  const fallbackAction = fullEntry?.action
  const action = optimizedAction ?? fallbackAction
  if (!action) throw new Error(`No local document action for ${key}`)
  const source = optimizedAction ? 'optimized' : 'full'
  const item = itemsByVideoId.get(video.id)
  if (!item) throw new Error(`No arrangement item for video ${video.id}`)
  const expectedDuration = Number(action.formal_duration_seconds)
  if (expectedDuration !== Number(video.duration)) {
    throw new Error(`${key} duration mismatch: document=${expectedDuration}, database=${video.duration}`)
  }
  const pretrainingCues = action.pretraining_cues.map((cue, index) => addCue(action, 'PRETRAINING', cue, index, source, item))
  const formalCues = action.formal_cues.map((cue, index) => addCue(action, 'FORMAL', cue, index, source, item))
  const targetMode = action.pretraining_mode === 'FULL' ? 'FULL' : 'NONE'
  const targetPretrainingDuration = targetMode === 'FULL' ? Number(action.pretraining_duration_seconds) : 0
  updates.push({
    item_id: item.id,
    arrangement_id: item.arrangement_id,
    exercise_video_id: video.id,
    key,
    source,
    action_name: action.action_name,
    precondition: {
      pretraining_mode: item.pretraining_mode,
      pretraining_duration: item.pretraining_duration,
      pretraining_countdown_duration: item.pretraining_countdown_duration
    },
    target: {
      pretraining_mode: targetMode,
      pretraining_duration: targetPretrainingDuration,
      pretraining_countdown_duration: targetMode === 'NONE' ? 0 : item.pretraining_countdown_duration
    },
    cues: [...pretrainingCues, ...formalCues]
  })
  if (optimizedAction) mergedOverrides.push({ key, document_number: optimizedAction.document_number, action_name: action.action_name })
}

if (!options.optimizedOnly && (updates.length !== items.length || updates.length !== videos.length)) {
  throw new Error(`Expected ${videos.length} updates for ${items.length} arrangement items; got ${updates.length}`)
}

const plan = {
  schema_version: 'local-training-tts-plan-v1',
  generated_at: new Date().toISOString(),
  voice: VOICE,
  rate: RATE,
  public_base_url: PUBLIC_BASE,
  action_count: updates.length,
  track_count: tracks.size,
  scope: options.optimizedOnly ? 'optimized-only' : 'full-merged',
  optimized_override_count: mergedOverrides.length,
  tracks: [...tracks.values()],
  updates,
  optimized_overrides: mergedOverrides
}
await writeFile(resolve(options.out), `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
console.log(`Wrote ${updates.length} item updates and ${tracks.size} unique audio tracks.`)
console.log(`Optimized traditional overrides: ${mergedOverrides.length}`)
