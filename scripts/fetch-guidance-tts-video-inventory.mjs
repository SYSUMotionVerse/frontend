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
    'Usage: GUIDANCE_TTS_KNOWN_HOSTS=<known_hosts> node scripts/fetch-guidance-tts-video-inventory.mjs --host <host> --user <user> --out <exercise-videos.json>'
  )
}

const djangoCode = [
  'import json',
  'from exercises.models import ExerciseVideo',
  "rows = list(ExerciseVideo.objects.filter(is_active=True).order_by('exercise_type', 'title').values('id', 'exercise_type', 'title', 'standard_data_url', 'duration', 'is_active'))",
  'print(json.dumps(rows, ensure_ascii=False))'
].join('; ')
const remoteCommand = `cd /srv/sport-snack && docker exec sport-snack-web-1 python manage.py shell --verbosity 0 -c ${JSON.stringify(djangoCode)}`
const stdout = await runVerifiedSsh({
  host: options.host,
  user: options.user,
  remoteCommand
})

let videos
try {
  videos = JSON.parse(stdout.trim())
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown JSON error'
  throw new Error(`Server did not return a valid video inventory: ${message}`)
}
if (!Array.isArray(videos) || videos.some(video => !video?.standard_data_url || !video?.title)) {
  throw new Error('Server returned an invalid active video inventory.')
}

const outputPath = resolve(options.out)
await writeFile(outputPath, `${JSON.stringify(videos, null, 2)}\n`, 'utf8')
console.log(`Wrote ${videos.length} active exercise videos to ${outputPath}`)
