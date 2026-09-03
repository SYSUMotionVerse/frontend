import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runVerifiedSsh } from './run-verified-ssh.mjs'

const options = {
  host: '',
  user: 'ubuntu',
  out: ''
}

for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index]
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2)
  if (key in options) options[key] = value
}

if (!options.host || !options.user || !options.out) {
  throw new Error(
    'Usage: GUIDANCE_TTS_KNOWN_HOSTS=<known_hosts> node scripts/fetch-guidance-tts-arrangement-items.mjs --host <host> --user <user> --out <arrangement-items.json>'
  )
}

const djangoCode = [
  'import json',
  'from exercises.models import ExerciseArrangementItem',
  "rows = list(ExerciseArrangementItem.objects.filter(exercise_video__is_active=True).order_by('arrangement_id', 'order').values('id', 'arrangement_id', 'arrangement__exercise_type', 'exercise_video_id', 'pretraining_mode', 'pretraining_duration', 'pretraining_countdown_duration', 'expected_duration', 'formal_countdown_duration', 'rest_duration', 'rest_countdown_duration', 'countdown_duration', 'order'))",
  'print(json.dumps(rows))'
].join('; ')
const remoteCommand = `cd /srv/sport-snack && docker exec sport-snack-web-1 python manage.py shell --verbosity 0 -c ${JSON.stringify(djangoCode)}`
const stdout = await runVerifiedSsh({
  host: options.host,
  user: options.user,
  remoteCommand
})

let items
try {
  items = JSON.parse(stdout.trim())
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown JSON error'
  throw new Error(`Server did not return valid arrangement items: ${message}`)
}
if (!Array.isArray(items) || items.some(item => !Number.isInteger(item?.exercise_video_id))) {
  throw new Error('Server returned an invalid active arrangement inventory.')
}

const outputPath = resolve(options.out)
await writeFile(outputPath, `${JSON.stringify(items, null, 2)}\n`, 'utf8')
console.log(`Wrote ${items.length} active arrangement items to ${outputPath}`)
