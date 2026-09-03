import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const options = {
  manifest: '',
  plan: '',
  videos: '',
  items: '',
  out: ''
}

for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index]
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2)
  if (key in options) options[key] = value
}

if (Object.values(options).some(value => !value)) {
  throw new Error(
    'Usage: node scripts/plan-guidance-tts-timing.mjs --manifest <manifest.json> --plan <plan.json> --videos <videos.json> --items <arrangement-items.json> --out <timing-plan.json>'
  )
}

const [manifest, ttsPlan, videos, items] = await Promise.all([
  readFile(resolve(options.manifest), 'utf8').then(JSON.parse),
  readFile(resolve(options.plan), 'utf8').then(JSON.parse),
  readFile(resolve(options.videos), 'utf8').then(JSON.parse),
  readFile(resolve(options.items), 'utf8').then(JSON.parse)
])

if (
  !Array.isArray(manifest.actions)
  || !Array.isArray(ttsPlan.tracks)
  || !Array.isArray(ttsPlan.updates)
  || !Array.isArray(videos)
  || !Array.isArray(items)
) {
  throw new Error('The manifest, TTS plan, videos, and arrangement items must all contain arrays.')
}

const actionsByKey = new Map(manifest.actions.map(action => [
  `${action.exercise_type}:${action.sequence}`,
  action
]))
const updatesByVideoId = new Map(ttsPlan.updates.map(update => [update.video_id, update]))
const videosById = new Map(videos.map(video => [video.id, video]))
const tracksByKey = new Map(ttsPlan.tracks.map(track => [track.key, track]))

if (updatesByVideoId.size !== ttsPlan.updates.length) {
  throw new Error('The TTS plan has duplicate video IDs.')
}

function startCountdownDuration(action) {
  const hasCountdownCue = action.cues.some(cue => (
    /[3３]\s*[，,、]\s*[2２]\s*[，,、]\s*[1１]\s*[，,、]?\s*go[！!]?/i.test(cue.text)
  ))
  return hasCountdownCue ? 3 : 0
}

function preparationDurationBeforeAction(ttsUpdate) {
  const audioUrl = ttsUpdate?.transition_audio_urls?.next_action
  if (typeof audioUrl !== 'string' || !audioUrl.trim()) return 0

  const audioKey = new URL(audioUrl).pathname.replace(/^\/+/, '')
  const track = tracksByKey.get(audioKey)
  if (
    !track
    || track.type !== 'preparation'
    || !Number.isInteger(track.duration_seconds)
    || track.duration_seconds <= 0
  ) {
    throw new Error(`Cannot derive preparation duration for ${ttsUpdate.key}.`)
  }
  return track.duration_seconds
}

function restDurationBeforeAction(action, ttsUpdate) {
  const restCues = action.cues.filter(cue => cue.phase === 'rest')
  if (restCues.length === 0) {
    // A document preparation track is the transition after the preceding
    // formal action. Reserve its full runtime as rest so its final 3-2-1-go
    // lands at the end of that phase instead of the next demonstration.
    return preparationDurationBeforeAction(ttsUpdate)
  }

  const durations = [...new Set(restCues.flatMap(cue => (
    [...cue.text.matchAll(/休息\s*(\d+)\s*秒/g)].map(match => Number(match[1]))
  )))]
  if (durations.length !== 1 || !Number.isInteger(durations[0]) || durations[0] <= 0) {
    throw new Error(`Cannot derive one rest duration from document action ${action.exercise_type}:${action.sequence}.`)
  }
  return durations[0]
}

const resolvedItems = []
for (const item of items) {
  const ttsUpdate = updatesByVideoId.get(item.exercise_video_id)
  const action = ttsUpdate ? actionsByKey.get(ttsUpdate.key) : undefined
  if (!action) {
    throw new Error(`No document action matches arrangement item ${item.id}.`)
  }
  resolvedItems.push({ item, action, ttsUpdate })
}

if (items.length !== ttsPlan.updates.length) {
  throw new Error('The active arrangement item count does not match the document action count.')
}

const itemUpdates = []
const itemsByArrangement = new Map()
for (const resolved of resolvedItems) {
  const group = itemsByArrangement.get(resolved.item.arrangement_id) ?? []
  group.push(resolved)
  itemsByArrangement.set(resolved.item.arrangement_id, group)
}
for (const [arrangementId, arrangementItems] of itemsByArrangement) {
  arrangementItems.sort((left, right) => left.item.order - right.item.order)
  const expectedOrders = Array.from({ length: arrangementItems.length }, (_, index) => index + 1)
  if (arrangementItems.map(({ item }) => item.order).join(',') !== expectedOrders.join(',')) {
    throw new Error(`Arrangement ${arrangementId} item order is not contiguous.`)
  }

  for (let index = 0; index < arrangementItems.length; index += 1) {
    const { item, action } = arrangementItems[index]
    const nextItem = arrangementItems[index + 1]
    const targetExpectedDuration = action.duration_seconds
    const targetCountdownDuration = startCountdownDuration(action)
    // The Mini Program reads rest_duration from the item that has just ended,
    // while document rest/preparation cues introduce the next action.
    const targetRestDuration = nextItem
      ? restDurationBeforeAction(nextItem.action, nextItem.ttsUpdate)
      : 0
    if (
      item.expected_duration !== targetExpectedDuration
      || item.countdown_duration !== targetCountdownDuration
      || item.rest_duration !== targetRestDuration
    ) {
      itemUpdates.push({
        item_id: item.id,
        arrangement_id: item.arrangement_id,
        exercise_video_id: item.exercise_video_id,
        current_expected_duration: item.expected_duration,
        target_expected_duration: targetExpectedDuration,
        current_countdown_duration: item.countdown_duration,
        target_countdown_duration: targetCountdownDuration,
        current_rest_duration: item.rest_duration,
        target_rest_duration: targetRestDuration
      })
    }
  }
}

const videoUpdates = []
for (const ttsUpdate of ttsPlan.updates) {
  const action = actionsByKey.get(ttsUpdate.key)
  const video = videosById.get(ttsUpdate.video_id)
  if (!action || !video) throw new Error(`Cannot resolve timing for ${ttsUpdate.key}.`)
  if (video.duration !== action.duration_seconds) {
    videoUpdates.push({
      video_id: video.id,
      key: ttsUpdate.key,
      current_duration: video.duration,
      target_duration: action.duration_seconds
    })
  }
}

const timingPlan = {
  schema_version: 'guidance-tts-timing-plan-v2',
  generated_at: new Date().toISOString(),
  action_count: ttsPlan.updates.length,
  item_updates: itemUpdates,
  video_updates: videoUpdates
}
const outputPath = resolve(options.out)
await writeFile(outputPath, `${JSON.stringify(timingPlan, null, 2)}\n`, 'utf8')

console.log(
  `Wrote ${itemUpdates.length} arrangement timing updates and ${videoUpdates.length} video duration updates to ${outputPath}`
)
