import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { loadEnv } from 'vite'
import { resolveCosUploadConfig } from './cos-upload-config.mjs'

const options = { plan: '', report: '', dryRun: false, publish: false }
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
if (!options.plan || options.dryRun === options.publish) {
  throw new Error('Usage: node scripts/upload-local-training-tts.mjs --plan <plan.json> (--dry-run | --publish) [--report <report.json>]')
}

const root = resolve(process.cwd())
const environment = { ...loadEnv('', root, ''), ...process.env }
const uploadConfig = resolveCosUploadConfig(environment)
if (uploadConfig.missing.length > 0) throw new Error(`Missing COS configuration: ${uploadConfig.missing.join(', ')}`)
const client = new COS({
  SecretId: environment.COS_SECRET_ID.trim(),
  SecretKey: environment.COS_SECRET_KEY.trim(),
  ...(environment.COS_SESSION_TOKEN?.trim() ? { Token: environment.COS_SESSION_TOKEN.trim() } : {})
})
const plan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
if (plan.schema_version !== 'local-training-tts-plan-v1' || !Array.isArray(plan.tracks)) throw new Error('Invalid local training TTS plan.')
for (const track of plan.tracks) {
  if (!/^training-tts\/cue\/[0-9a-f]{64}\.mp3$/.test(track.key)) throw new Error(`Unsafe COS key: ${track.key}`)
  const local = await stat(resolve(track.local_path))
  if (!local.isFile() || local.size <= 0) throw new Error(`Missing local audio: ${track.local_path}`)
}
const report = {
  schema_version: 'local-training-tts-upload-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  scope: plan.scope,
  track_count: plan.tracks.length,
  byte_size: 0,
  uploaded: 0
}
for (const track of plan.tracks) report.byte_size += (await stat(resolve(track.local_path))).size

if (options.publish) {
  let next = 0
  const workers = Array.from({ length: Math.min(6, plan.tracks.length) }, async () => {
    while (true) {
      const index = next++
      if (index >= plan.tracks.length) return
      const track = plan.tracks[index]
      const body = await readFile(resolve(track.local_path))
      await new Promise((resolvePromise, rejectPromise) => {
        client.putObject({
          Bucket: uploadConfig.bucket,
          Region: uploadConfig.region,
          Key: track.key,
          Body: body,
          ContentLength: body.length,
          ContentType: 'audio/mpeg',
          CacheControl: 'public, max-age=31536000, immutable'
        }, error => error ? rejectPromise(error) : resolvePromise())
      })
      report.uploaded += 1
      if (report.uploaded % 25 === 0 || report.uploaded === plan.tracks.length) console.log(`Uploaded ${report.uploaded}/${plan.tracks.length} training TTS assets`)
    }
  })
  await Promise.all(workers)
}
if (options.report) await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`${options.dryRun ? 'Dry run passed' : 'Uploaded'}: ${report.track_count} assets, ${report.byte_size} bytes.`)
