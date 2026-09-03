import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runVerifiedSsh } from './run-verified-ssh.mjs'

const options = {
  mapping: '',
  host: '',
  user: 'ubuntu',
  report: '',
  dryRun: false,
  publish: false
}

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]
  if (argument === '--dry-run') {
    options.dryRun = true
    continue
  }
  if (argument === '--publish') {
    options.publish = true
    continue
  }
  if (!argument?.startsWith('--')) continue
  const key = argument.slice(2)
  const value = process.argv[index + 1]
  if (key in options && key !== 'dryRun' && key !== 'publish' && value) {
    options[key] = value
    index += 1
  }
}

if (!options.mapping || !options.host || !options.user || options.dryRun === options.publish) {
  throw new Error(
    'Usage: GUIDANCE_TTS_KNOWN_HOSTS=<known_hosts> node scripts/update-guidance-tts-standard-urls.mjs --mapping <url-map.json> --host <host> --user <user> (--dry-run | --publish) [--report <report.json>]'
  )
}

function validateMapping(mapping) {
  if (mapping?.schema_version !== 'guidance-tts-standard-url-map-v1' || !Array.isArray(mapping.updates)) {
    throw new Error('Unexpected standard URL mapping format.')
  }
  if (mapping.action_count !== mapping.updates.length) {
    throw new Error('Mapping action count does not match its updates.')
  }
  const ids = new Set()
  for (const update of mapping.updates) {
    if (
      !Number.isInteger(update?.video_id)
      || typeof update.expected_standard_data_url !== 'string'
      || typeof update.standard_data_url !== 'string'
      || !update.expected_standard_data_url.startsWith('https://')
      || !update.standard_data_url.startsWith('https://')
      || !/\/standard-guidance-tts-v\d+\.json$/.test(new URL(update.standard_data_url).pathname)
    ) {
      throw new Error('Mapping contains an invalid database update.')
    }
    if (ids.has(update.video_id)) throw new Error(`Mapping contains duplicate video ID ${update.video_id}.`)
    ids.add(update.video_id)
  }
}

const mapping = JSON.parse(await readFile(resolve(options.mapping), 'utf8'))
validateMapping(mapping)
const payload = mapping.updates.map(update => ({
  video_id: update.video_id,
  expected_standard_data_url: update.expected_standard_data_url,
  standard_data_url: update.standard_data_url
}))
const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
const djangoCode = [
  'import base64',
  'import json',
  'from django.db import transaction',
  'from exercises.models import ExerciseVideo',
  `updates = json.loads(base64.b64decode('${encodedPayload}').decode('utf-8'))`,
  "ids = [item['video_id'] for item in updates]",
  'with transaction.atomic():',
  '    rows = {row.id: row for row in ExerciseVideo.objects.select_for_update().filter(id__in=ids)}',
  '    if len(rows) != len(updates):',
  "        raise RuntimeError(f'Expected {len(updates)} exercise videos but found {len(rows)}')",
  "    mismatches = [item['video_id'] for item in updates if not rows[item['video_id']].is_active or rows[item['video_id']].standard_data_url != item['expected_standard_data_url']]",
  '    if mismatches:',
  "        raise RuntimeError(f'Standard URL precondition failed for video IDs: {mismatches}')",
  `    if ${options.publish ? 'True' : 'False'}:`,
  '        for item in updates:',
  "            row = rows[item['video_id']]",
  "            row.standard_data_url = item['standard_data_url']",
  "            row.save(update_fields=['standard_data_url', 'updated_at'])",
  "result = {'action_count': len(updates), 'updated_count': len(updates) if " + (options.publish ? 'True' : 'False') + " else 0, 'video_ids': sorted(ids)}",
  'print(json.dumps(result))'
].join('\n')
const encodedCode = Buffer.from(djangoCode, 'utf8').toString('base64')
const runner = `import base64; exec(compile(base64.b64decode('${encodedCode}'), '<guidance-tts-standard-url-update>', 'exec'))`
const remoteCommand = `cd /srv/sport-snack && docker exec sport-snack-web-1 python manage.py shell -c ${JSON.stringify(runner)}`
const stdout = await runVerifiedSsh({
  host: options.host,
  user: options.user,
  remoteCommand
})

const lastLine = stdout.trim().split('\n').filter(Boolean).at(-1) ?? ''
let remoteResult
try {
  remoteResult = JSON.parse(lastLine)
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown JSON error'
  throw new Error(`Server did not return a valid update report: ${message}`)
}
if (remoteResult.action_count !== payload.length || remoteResult.updated_count !== (options.publish ? payload.length : 0)) {
  throw new Error('Server update report did not match the requested update count.')
}

const report = {
  schema_version: 'guidance-tts-database-url-update-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  action_count: payload.length,
  updated_count: remoteResult.updated_count
}
if (options.report) {
  await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
console.log(
  `${options.dryRun ? 'Dry run passed' : 'Database URLs updated'}: ${report.action_count} actions, ${report.updated_count} rows changed.`
)
