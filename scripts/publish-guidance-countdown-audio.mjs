import { readFile, stat, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { loadEnv } from 'vite'
import { resolveCosUploadConfig } from './cos-upload-config.mjs'

const options = {
  plan: '',
  audio: '',
  report: '',
  dryRun: false,
  publish: false,
  force: false
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
  if (argument === '--force') {
    options.force = true
    continue
  }
  if (!argument?.startsWith('--')) continue
  const key = argument.slice(2)
  const value = process.argv[index + 1]
  if (key in options && key !== 'dryRun' && key !== 'publish' && key !== 'force' && value) {
    options[key] = value
    index += 1
  }
}

if (!options.plan || !options.audio || options.dryRun === options.publish) {
  throw new Error(
    'Usage: node scripts/publish-guidance-countdown-audio.mjs --plan <plan.json> --audio <directory> (--dry-run | --publish) [--force] [--report <report.json>]'
  )
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isSafeObjectKey(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('..')
    && !value.includes('\\')
}

function toBuffer(value, context) {
  if (Buffer.isBuffer(value)) return value
  if (typeof value === 'string') return Buffer.from(value)
  if (value instanceof Uint8Array) return Buffer.from(value)
  throw new Error(`${context} did not return a readable body.`)
}

function callCos(method, parameters) {
  return new Promise((resolvePromise, rejectPromise) => {
    client[method](parameters, (error, result) => {
      if (error) {
        rejectPromise(error)
        return
      }
      resolvePromise(result)
    })
  })
}

function standardKeyFromUrl(url, publicBaseUrl) {
  const parsedUrl = new URL(url)
  const publicBase = new URL(publicBaseUrl)
  if (parsedUrl.origin !== publicBase.origin) {
    throw new Error(`Standard URL does not use the configured COS public origin: ${url}`)
  }
  const basePath = publicBase.pathname.replace(/\/+$/, '')
  if (basePath && !parsedUrl.pathname.startsWith(`${basePath}/`)) {
    throw new Error(`Standard URL does not use the configured COS public path: ${url}`)
  }
  const key = decodeURIComponent(parsedUrl.pathname.slice(basePath.length)).replace(/^\/+/, '')
  if (!/^actions\/[0-9a-f-]{36}\/standard-guidance-tts-v\d+\.json$/i.test(key)) {
    throw new Error(`Unsupported guidance standard object key: ${key}`)
  }
  return key
}

function audioKeyFromUrl(url, publicBaseUrl) {
  const parsedUrl = new URL(url)
  const publicBase = new URL(publicBaseUrl)
  if (parsedUrl.origin !== publicBase.origin) {
    throw new Error(`Countdown audio URL does not use the configured COS public origin: ${url}`)
  }
  const basePath = publicBase.pathname.replace(/\/+$/, '')
  if (basePath && !parsedUrl.pathname.startsWith(`${basePath}/`)) {
    throw new Error(`Countdown audio URL does not use the configured COS public path: ${url}`)
  }
  const key = decodeURIComponent(parsedUrl.pathname.slice(basePath.length)).replace(/^\/+/, '')
  if (!isSafeObjectKey(key)) throw new Error(`Unsafe countdown audio key: ${key}`)
  return key
}

function parseStandard(result, key) {
  let parsed
  try {
    parsed = JSON.parse(toBuffer(result.Body, key).toString('utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown JSON error'
    throw new Error(`${key} is not valid JSON: ${message}`)
  }
  if (!isRecord(parsed)) throw new Error(`${key} is not a JSON object.`)
  return parsed
}

function mapConcurrent(values, concurrency, callback) {
  const results = new Array(values.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= values.length) return
      results[index] = await callback(values[index], index)
    }
  })
  return Promise.all(workers).then(() => results)
}

const root = resolve(process.cwd())
const environment = {
  ...loadEnv('', root, ''),
  ...process.env
}
const uploadConfig = resolveCosUploadConfig(environment)
if (uploadConfig.missing.length > 0) {
  throw new Error(`Missing COS configuration: ${uploadConfig.missing.join(', ')}`)
}
const client = new COS({
  SecretId: environment.COS_SECRET_ID.trim(),
  SecretKey: environment.COS_SECRET_KEY.trim(),
  ...(environment.COS_SESSION_TOKEN?.trim() ? { Token: environment.COS_SESSION_TOKEN.trim() } : {})
})

const plan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
if (
  plan?.schema_version !== 'guidance-countdown-audio-plan-v1'
  || !Array.isArray(plan.tracks)
  || !Array.isArray(plan.updates)
  || plan.track_count !== plan.tracks.length
  || plan.standard_update_count !== plan.updates.length
) {
  throw new Error('Countdown plan has an invalid schema or count fields.')
}
if (plan.public_base_url !== uploadConfig.publicBaseUrl) {
  throw new Error('Countdown plan does not use the configured COS public base URL.')
}

const trackKeys = new Set()
for (const track of plan.tracks) {
  if (!isRecord(track) || !isSafeObjectKey(track.key) || !track.key.startsWith('shared/tts/guidance-v1/countdown-')) {
    throw new Error('Countdown plan contains an unsafe audio track.')
  }
  if (trackKeys.has(track.key)) throw new Error(`Countdown plan has duplicate track ${track.key}.`)
  trackKeys.add(track.key)
}
if (trackKeys.size !== 3) throw new Error('Countdown plan must contain exactly three audio tracks.')

const updateKeys = new Set()
for (const update of plan.updates) {
  if (!isRecord(update) || !Number.isInteger(update.video_id) || !isRecord(update.countdown_audio_urls)) {
    throw new Error('Countdown plan contains an invalid standard update.')
  }
  const standardKey = standardKeyFromUrl(update.standard_data_url, uploadConfig.publicBaseUrl)
  if (updateKeys.has(standardKey)) throw new Error(`Countdown plan has duplicate standard ${standardKey}.`)
  updateKeys.add(standardKey)
  for (const seconds of ['3', '2', '1']) {
    const audioUrl = update.countdown_audio_urls[seconds]
    if (typeof audioUrl !== 'string') throw new Error(`Countdown plan is missing ${seconds}s audio.`)
    const audioKey = audioKeyFromUrl(audioUrl, uploadConfig.publicBaseUrl)
    if (!trackKeys.has(audioKey)) {
      throw new Error(`Countdown standard ${standardKey} references missing track ${audioKey}.`)
    }
  }
}

const audioDirectory = resolve(options.audio)
const audioAssets = await Promise.all(plan.tracks.map(async track => {
  const localPath = resolve(audioDirectory, track.key)
  const relativePath = relative(audioDirectory, localPath)
  if (relativePath.startsWith('..') || relativePath.includes(`..${'/'}`)) {
    throw new Error(`Countdown audio resolves outside its directory: ${track.key}`)
  }
  const localStat = await stat(localPath)
  if (!localStat.isFile() || localStat.size <= 0) {
    throw new Error(`Countdown audio asset is missing or empty: ${localPath}`)
  }
  return { key: track.key, localPath, byteSize: localStat.size }
}))

async function readStandard(update) {
  const standardKey = standardKeyFromUrl(update.standard_data_url, uploadConfig.publicBaseUrl)
  const result = await callCos('getObject', {
    Bucket: uploadConfig.bucket,
    Region: uploadConfig.region,
    Key: standardKey
  })
  return { standardKey, standard: parseStandard(result, standardKey) }
}

const inspected = await mapConcurrent(plan.updates, 4, async update => {
  const { standardKey, standard } = await readStandard(update)
  const current = standard.countdown_audio_urls
  if (sameJson(current, update.countdown_audio_urls)) {
    return { update, standardKey, state: 'current' }
  }
  if (current !== undefined && !options.force) {
    return { update, standardKey, state: 'conflict' }
  }
  return { update, standardKey, state: 'pending' }
})

const conflicts = inspected.filter(item => item.state === 'conflict')
if (conflicts.length > 0) {
  throw new Error(
    `${conflicts.length} countdown standards already use a different audio mapping. Re-run with --force only after reviewing them.`
  )
}
const pending = inspected.filter(item => item.state === 'pending')
const report = {
  schema_version: 'guidance-countdown-audio-publish-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  standard_count: plan.updates.length,
  already_current_count: inspected.filter(item => item.state === 'current').length,
  pending_standard_count: pending.length,
  audio_asset_count: audioAssets.length,
  audio_asset_byte_size: audioAssets.reduce((total, asset) => total + asset.byteSize, 0),
  audio_assets_uploaded: 0,
  standard_updates_written: 0
}

if (options.publish && pending.length > 0) {
  await mapConcurrent(audioAssets, 3, async asset => {
    await callCos('putObject', {
      Bucket: uploadConfig.bucket,
      Region: uploadConfig.region,
      Key: asset.key,
      Body: await readFile(asset.localPath),
      ContentLength: asset.byteSize,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable'
    })
  })
  report.audio_assets_uploaded = audioAssets.length

  await mapConcurrent(pending, 4, async ({ update, standardKey }) => {
    const current = await readStandard(update)
    if (
      current.standard.countdown_audio_urls !== undefined
      && !sameJson(current.standard.countdown_audio_urls, update.countdown_audio_urls)
      && !options.force
    ) {
      throw new Error(`${standardKey} changed after preflight; refusing to overwrite its countdown audio.`)
    }
    const nextStandard = {
      ...current.standard,
      countdown_audio_urls: update.countdown_audio_urls
    }
    const body = Buffer.from(`${JSON.stringify(nextStandard, null, 2)}\n`, 'utf8')
    await callCos('putObject', {
      Bucket: uploadConfig.bucket,
      Region: uploadConfig.region,
      Key: standardKey,
      Body: body,
      ContentLength: body.length,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-cache'
    })
    const verification = await readStandard(update)
    if (!sameJson(verification.standard.countdown_audio_urls, update.countdown_audio_urls)) {
      throw new Error(`Countdown audio read-back verification failed for ${standardKey}.`)
    }
  })
  report.standard_updates_written = pending.length
}

if (options.report) {
  await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

console.log(
  `${options.dryRun ? 'Dry run passed' : 'Published'}: ${report.standard_count} countdown standards, ${report.pending_standard_count} pending updates.`
)
