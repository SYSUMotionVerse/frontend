import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runVerifiedSsh } from './run-verified-ssh.mjs'

const options = {
  plan: '',
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

if (!options.plan || !options.host || !options.user || options.dryRun === options.publish) {
  throw new Error(
    'Usage: GUIDANCE_TTS_KNOWN_HOSTS=<known_hosts> node scripts/update-guidance-tts-timing.mjs --plan <timing-plan.json> --host <host> --user <user> (--dry-run | --publish) [--report <report.json>]'
  )
}

function validatePlan(plan) {
  if (
    plan?.schema_version !== 'guidance-tts-timing-plan-v2'
    || !Array.isArray(plan.item_updates)
    || !Array.isArray(plan.video_updates)
  ) {
    throw new Error('Unexpected guidance TTS timing plan format.')
  }
  const itemIds = new Set()
  for (const update of plan.item_updates) {
    if (
      !Number.isInteger(update?.item_id)
      || !Number.isInteger(update.arrangement_id)
      || !Number.isInteger(update.exercise_video_id)
      || !Number.isInteger(update.current_expected_duration)
      || !Number.isInteger(update.target_expected_duration)
      || !Number.isInteger(update.current_countdown_duration)
      || !Number.isInteger(update.target_countdown_duration)
      || !Number.isInteger(update.current_rest_duration)
      || !Number.isInteger(update.target_rest_duration)
      || update.target_expected_duration <= 0
      || update.target_countdown_duration < 0
      || update.target_rest_duration < 0
    ) {
      throw new Error('Timing plan contains an invalid arrangement item update.')
    }
    if (itemIds.has(update.item_id)) throw new Error(`Timing plan has duplicate item ID ${update.item_id}.`)
    itemIds.add(update.item_id)
  }
  const videoIds = new Set()
  for (const update of plan.video_updates) {
    if (
      !Number.isInteger(update?.video_id)
      || !Number.isInteger(update.current_duration)
      || !Number.isInteger(update.target_duration)
      || update.target_duration <= 0
    ) {
      throw new Error('Timing plan contains an invalid video duration update.')
    }
    if (videoIds.has(update.video_id)) throw new Error(`Timing plan has duplicate video ID ${update.video_id}.`)
    videoIds.add(update.video_id)
  }
}

const timingPlan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
validatePlan(timingPlan)
const payload = {
  item_updates: timingPlan.item_updates,
  video_updates: timingPlan.video_updates
}
const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
const djangoCode = [
  'import base64',
  'import json',
  'from django.db import transaction',
  'from exercises.models import ExerciseArrangementItem, ExerciseVideo',
  `payload = json.loads(base64.b64decode('${encodedPayload}').decode('utf-8'))`,
  "item_updates = payload['item_updates']",
  "video_updates = payload['video_updates']",
  "item_ids = [item['item_id'] for item in item_updates]",
  "video_ids = [item['video_id'] for item in video_updates]",
  'with transaction.atomic():',
  '    item_rows = {row.id: row for row in ExerciseArrangementItem.objects.select_for_update().filter(id__in=item_ids)}',
  '    video_rows = {row.id: row for row in ExerciseVideo.objects.select_for_update().filter(id__in=video_ids)}',
  '    if len(item_rows) != len(item_updates):',
  "        raise RuntimeError(f'Expected {len(item_updates)} arrangement items but found {len(item_rows)}')",
  '    if len(video_rows) != len(video_updates):',
  "        raise RuntimeError(f'Expected {len(video_updates)} exercise videos but found {len(video_rows)}')",
  "    invalid_items = [item['item_id'] for item in item_updates if item_rows[item['item_id']].arrangement_id != item['arrangement_id'] or item_rows[item['item_id']].exercise_video_id != item['exercise_video_id'] or item_rows[item['item_id']].expected_duration != item['current_expected_duration'] or item_rows[item['item_id']].countdown_duration != item['current_countdown_duration'] or item_rows[item['item_id']].rest_duration != item['current_rest_duration']]",
  '    if invalid_items:',
  "        raise RuntimeError(f'Arrangement timing precondition failed for item IDs: {invalid_items}')",
  "    invalid_videos = [item['video_id'] for item in video_updates if not video_rows[item['video_id']].is_active or video_rows[item['video_id']].duration != item['current_duration']]",
  '    if invalid_videos:',
  "        raise RuntimeError(f'Video timing precondition failed for video IDs: {invalid_videos}')",
  `    if ${options.publish ? 'True' : 'False'}:`,
  '        for item in item_updates:',
  "            row = item_rows[item['item_id']]",
  "            row.expected_duration = item['target_expected_duration']",
  "            row.countdown_duration = item['target_countdown_duration']",
  "            row.rest_duration = item['target_rest_duration']",
  "            row.save(update_fields=['expected_duration', 'countdown_duration', 'rest_duration'])",
  '        for item in video_updates:',
  "            row = video_rows[item['video_id']]",
  "            row.duration = item['target_duration']",
  "            row.save(update_fields=['duration', 'updated_at'])",
  "result = {'item_update_count': len(item_updates), 'video_update_count': len(video_updates), 'items_updated': len(item_updates) if " + (options.publish ? 'True' : 'False') + " else 0, 'videos_updated': len(video_updates) if " + (options.publish ? 'True' : 'False') + " else 0}",
  'print(json.dumps(result))'
].join('\n')
const encodedCode = Buffer.from(djangoCode, 'utf8').toString('base64')
const runner = `import base64; exec(compile(base64.b64decode('${encodedCode}'), '<guidance-tts-timing-update>', 'exec'))`
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
  throw new Error(`Server did not return a valid timing update report: ${message}`)
}
const expectedItemUpdates = options.publish ? payload.item_updates.length : 0
const expectedVideoUpdates = options.publish ? payload.video_updates.length : 0
if (
  remoteResult.item_update_count !== payload.item_updates.length
  || remoteResult.video_update_count !== payload.video_updates.length
  || remoteResult.items_updated !== expectedItemUpdates
  || remoteResult.videos_updated !== expectedVideoUpdates
) {
  throw new Error('Server timing update report did not match the requested update count.')
}

const report = {
  schema_version: 'guidance-tts-timing-update-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  item_update_count: payload.item_updates.length,
  video_update_count: payload.video_updates.length,
  items_updated: remoteResult.items_updated,
  videos_updated: remoteResult.videos_updated
}
if (options.report) {
  await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
console.log(
  `${options.dryRun ? 'Dry run passed' : 'Timing updated'}: ${report.item_update_count} arrangement items and ${report.video_update_count} video durations.`
)
