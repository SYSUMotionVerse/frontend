import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { runVerifiedSsh } from './run-verified-ssh.mjs'

const options = { plan: '', host: '', user: 'ubuntu', report: '', dryRun: false, publish: false }
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]
  if (argument === '--dry-run') { options.dryRun = true; continue }
  if (argument === '--publish') { options.publish = true; continue }
  if (!argument?.startsWith('--')) continue
  const key = argument.slice(2)
  const value = process.argv[index + 1]
  if (key in options && key !== 'dryRun' && key !== 'publish' && value) {
    options[key] = value
    index += 1
  }
}
if (!options.plan || !options.host || options.dryRun === options.publish) {
  throw new Error('Usage: GUIDANCE_TTS_KNOWN_HOSTS=<known_hosts> node scripts/update-local-training-tts.mjs --plan <plan.json> --host <host> --user <user> (--dry-run | --publish) [--report <report.json>]')
}

const plan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
if (plan.schema_version !== 'local-training-tts-plan-v1' || !Array.isArray(plan.updates)) throw new Error('Invalid local training TTS plan.')
const itemIds = new Set()
for (const update of plan.updates) {
  if (!Number.isInteger(update.item_id) || !Number.isInteger(update.arrangement_id) || !Number.isInteger(update.exercise_video_id)) throw new Error('Plan contains an invalid arrangement item update.')
  if (itemIds.has(update.item_id)) throw new Error(`Duplicate arrangement item ${update.item_id}`)
  itemIds.add(update.item_id)
  if (!update.precondition || !update.target || !Array.isArray(update.cues)) throw new Error(`Incomplete update for item ${update.item_id}`)
  for (const cue of update.cues) {
    if (!['PRETRAINING', 'FORMAL'].includes(cue.phase) || !['START', 'AFTER_OFFSET'].includes(cue.timing) || !Number.isInteger(cue.offset_seconds) || cue.offset_seconds < 0 || cue.offset_seconds > 60 || !cue.text?.trim() || !/^[0-9a-f]{64}$/.test(cue.render_fingerprint) || !/^https:\/\/cdn\.sysusports\.cn\/training-tts\/cue\/[0-9a-f]{64}\.mp3$/.test(cue.audio_url)) {
      throw new Error(`Invalid cue in item ${update.item_id}`)
    }
  }
}

const payload = gzipSync(Buffer.from(JSON.stringify({ updates: plan.updates }), 'utf8')).toString('base64')
const djangoCode = [
  'import base64, gzip, json',
  'from django.db import transaction',
  'from django.utils import timezone',
  'from exercises.models import ExerciseArrangementItem, ExerciseArrangementItemTtsCue',
  `payload = json.loads(gzip.decompress(base64.b64decode('${payload}')).decode('utf-8'))`,
  "updates = payload['updates']",
  'item_ids = [update[\'item_id\'] for update in updates]',
  'with transaction.atomic():',
  '    rows = {row.id: row for row in ExerciseArrangementItem.objects.select_for_update().filter(id__in=item_ids)}',
  '    if len(rows) != len(updates): raise RuntimeError(f\'Expected {len(updates)} items but found {len(rows)}\')',
  '    for update in updates:',
  '        row = rows[update[\'item_id\']]',
  '        pre = update[\'precondition\']',
  '        if row.arrangement_id != update[\'arrangement_id\'] or row.exercise_video_id != update[\'exercise_video_id\']:',
  '            raise RuntimeError(f\'Relationship precondition failed for item {row.id}\')',
  '        if row.pretraining_mode != pre[\'pretraining_mode\'] or row.pretraining_duration != pre[\'pretraining_duration\'] or row.pretraining_countdown_duration != pre[\'pretraining_countdown_duration\']:',
  '            raise RuntimeError(f\'Timing precondition failed for item {row.id}\')',
  `    if ${options.publish ? 'True' : 'False'}:`,
  '        now = timezone.now()',
  '        for update in updates:',
  '            row = rows[update[\'item_id\']]',
  '            target = update[\'target\']',
  '            row.pretraining_mode = target[\'pretraining_mode\']',
  '            row.pretraining_duration = target[\'pretraining_duration\']',
  '            row.pretraining_countdown_duration = target[\'pretraining_countdown_duration\']',
  "            row.save(update_fields=['pretraining_mode', 'pretraining_duration', 'pretraining_countdown_duration'])",
  '            row.training_tts_cues.all().delete()',
  '            for cue in update[\'cues\']:',
  '                ExerciseArrangementItemTtsCue.objects.create(',
  '                    arrangement_item=row, phase=cue[\'phase\'], timing=cue[\'timing\'],',
  '                    offset_seconds=cue[\'offset_seconds\'], text=cue[\'text\'], is_enabled=True,',
  '                    audio_url=cue[\'audio_url\'], render_fingerprint=cue[\'render_fingerprint\'], generation_status=ExerciseArrangementItemTtsCue.STATUS_PUBLISHED,',
  '                    generation_error=\'\', generated_at=now, source=ExerciseArrangementItemTtsCue.SOURCE_LEGACY,',
  '                    legacy_key=f"local-0825:{cue[\'phase\']}:{cue[\'order\']}", order=cue[\'order\']',
  '                )',
  'result = {\'item_count\': len(updates), \'cue_count\': sum(len(update[\'cues\']) for update in updates), \'items_updated\': len(updates) if ' + (options.publish ? 'True' : 'False') + ' else 0}',
  'print(json.dumps(result))'
].join('\n')
const runner = `import base64; exec(compile(base64.b64decode('${Buffer.from(djangoCode, 'utf8').toString('base64')}'), '<local-training-tts-update>', 'exec'))`
const stdout = await runVerifiedSsh({
  host: options.host,
  user: options.user,
  remoteCommand: `cd /srv/sport-snack && docker exec sport-snack-web-1 python manage.py shell --verbosity 0 -c ${JSON.stringify(runner)}`
})
const lastLine = stdout.trim().split('\n').filter(Boolean).at(-1) ?? ''
let remoteResult
try { remoteResult = JSON.parse(lastLine) } catch (error) { throw new Error(`Server did not return a valid DB update report: ${error.message}`) }
if (remoteResult.item_count !== plan.updates.length || remoteResult.cue_count !== plan.updates.reduce((count, update) => count + update.cues.length, 0) || remoteResult.items_updated !== (options.publish ? plan.updates.length : 0)) {
  throw new Error('Server DB update report did not match the requested plan.')
}
const report = {
  schema_version: 'local-training-tts-db-update-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  scope: plan.scope,
  item_count: remoteResult.item_count,
  cue_count: remoteResult.cue_count,
  items_updated: remoteResult.items_updated
}
if (options.report) await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`${options.dryRun ? 'Dry run passed' : 'Database updated'}: ${report.item_count} items, ${report.cue_count} cues.`)
