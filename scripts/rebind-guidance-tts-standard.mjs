import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const options = {
  plan: '',
  videoId: '',
  standardUrl: '',
  out: ''
}

for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index]
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
  if (key in options) options[key] = value
}

if (!options.plan || !options.videoId || !options.standardUrl || !options.out) {
  throw new Error(
    'Usage: node scripts/rebind-guidance-tts-standard.mjs --plan <plan.json> --video-id <id> --standard-url <current-standard-url> --out <rebound-plan.json>'
  )
}

const videoId = Number(options.videoId)
if (!Number.isInteger(videoId)) throw new Error('--video-id must be an integer.')
const standardUrl = new URL(options.standardUrl)
if (standardUrl.protocol !== 'https:' || !/\/actions\/[0-9a-f-]{36}\/standard(?:-guidance-tts-v\d+)?\.json$/i.test(standardUrl.pathname)) {
  throw new Error('--standard-url must be an HTTPS action standard URL.')
}

const plan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
if (plan?.schema_version !== 'guidance-tts-plan-v1' || !Array.isArray(plan.updates)) {
  throw new Error('Unexpected guidance TTS plan format.')
}
const sourceUpdate = plan.updates.find(update => update.video_id === videoId)
if (!sourceUpdate) throw new Error(`No TTS update found for video ID ${videoId}.`)

const output = {
  schema_version: 'guidance-tts-plan-v1',
  generated_at: new Date().toISOString(),
  action_count: 1,
  track_count: 0,
  tracks: [],
  updates: [{
    ...sourceUpdate,
    standard_data_url: standardUrl.toString()
  }],
  differences: []
}
const outputPath = resolve(options.out)
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Rebound ${sourceUpdate.key} (video ${videoId}) to ${standardUrl.pathname}`)
