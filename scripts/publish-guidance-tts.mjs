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
    'Usage: node scripts/publish-guidance-tts.mjs --plan <plan.json> --audio <directory> (--dry-run | --publish) [--force] [--report <report.json>]'
  )
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeObjectKey(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('..')
    && !value.includes('\\')
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

function getObject(parameters) {
  return callCos('getObject', parameters)
}

function putObject(parameters) {
  return callCos('putObject', parameters)
}

function toBuffer(value, context) {
  if (Buffer.isBuffer(value)) return value
  if (typeof value === 'string') return Buffer.from(value)
  if (value instanceof Uint8Array) return Buffer.from(value)
  throw new Error(`${context} did not return a readable body.`)
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
  if (!/^actions\/[0-9a-f-]{36}\/standard(?:-guidance-tts-v\d+)?\.json$/i.test(key)) {
    throw new Error(`Unsupported standard object key: ${key}`)
  }
  return key
}

function actionPrefixFromStandardKey(standardKey) {
  return standardKey.replace(/\/standard(?:-guidance-tts-v\d+)?\.json$/, '')
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function mapConcurrent(values, concurrency, callback) {
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
  await Promise.all(workers)
  return results
}

function validatePlan(plan, publicBaseUrl) {
  if (plan?.schema_version !== 'guidance-tts-plan-v1') {
    throw new Error('Unexpected guidance TTS plan version.')
  }
  if (!Array.isArray(plan.tracks) || !Array.isArray(plan.updates)) {
    throw new Error('Plan must contain tracks and updates arrays.')
  }
  if (plan.action_count !== plan.updates.length || plan.track_count !== plan.tracks.length) {
    throw new Error('Plan count fields do not match its contents.')
  }

  const trackKeys = new Set()
  for (const track of plan.tracks) {
    if (!isRecord(track) || !isSafeObjectKey(track.key)) {
      throw new Error('Plan contains an unsafe audio object key.')
    }
    if (trackKeys.has(track.key)) throw new Error(`Plan has a duplicate audio key: ${track.key}`)
    trackKeys.add(track.key)
  }

  const standardKeys = new Set()
  for (const update of plan.updates) {
    if (!isRecord(update) || !Array.isArray(update.tts_cues)) {
      throw new Error('Plan contains an invalid standard update.')
    }
    const standardKey = standardKeyFromUrl(update.standard_data_url, publicBaseUrl)
    if (standardKeys.has(standardKey)) throw new Error(`Plan has a duplicate standard key: ${standardKey}`)
    standardKeys.add(standardKey)
    const actionPrefix = actionPrefixFromStandardKey(standardKey)
    for (const cue of update.tts_cues) {
      if (!isRecord(cue) || typeof cue.time !== 'number' || typeof cue.text !== 'string' || typeof cue.audio_url !== 'string') {
        throw new Error(`Plan has an invalid tts_cue for ${standardKey}`)
      }
      const audioKey = standardKeyFromAudioUrl(cue.audio_url, publicBaseUrl)
      const directActionAudio = audioKey.startsWith(`${actionPrefix}/tts/`)
      const namespacedActionAudio = audioKey.startsWith('training-tts/replacements/')
        && audioKey.includes(`/${actionPrefix}/tts/`)
      if ((!directActionAudio && !namespacedActionAudio) || !trackKeys.has(audioKey)) {
        throw new Error(`Plan references a missing active audio asset: ${audioKey}`)
      }
    }
    if (update.transition_audio_urls !== undefined) {
      if (!isRecord(update.transition_audio_urls)) {
        throw new Error(`Plan has an invalid transition audio object for ${standardKey}`)
      }
      for (const [name, audioUrl] of Object.entries(update.transition_audio_urls)) {
        if (typeof audioUrl !== 'string') {
          throw new Error(`Plan has an invalid ${name} audio URL for ${standardKey}`)
        }
        const audioKey = standardKeyFromAudioUrl(audioUrl, publicBaseUrl)
        if (!trackKeys.has(audioKey)) {
          throw new Error(`Plan references a missing ${name} audio asset: ${audioKey}`)
        }
      }
    }
  }
}

function standardKeyFromAudioUrl(url, publicBaseUrl) {
  const parsedUrl = new URL(url)
  const publicBase = new URL(publicBaseUrl)
  if (parsedUrl.origin !== publicBase.origin) {
    throw new Error(`Audio URL does not use the configured COS public origin: ${url}`)
  }
  const basePath = publicBase.pathname.replace(/\/+$/, '')
  if (basePath && !parsedUrl.pathname.startsWith(`${basePath}/`)) {
    throw new Error(`Audio URL does not use the configured COS public path: ${url}`)
  }
  const key = decodeURIComponent(parsedUrl.pathname.slice(basePath.length)).replace(/^\/+/, '')
  if (!isSafeObjectKey(key)) throw new Error(`Unsafe audio object key: ${key}`)
  return key
}

function assertNoExistingGuidance(standard, standardKey) {
  const existingCues = standard.tts_cues
  const existingTransitionAudio = standard.transition_audio_urls
  const cueCount = Array.isArray(existingCues) ? existingCues.length : 0
  const transitionCount = isRecord(existingTransitionAudio) ? Object.keys(existingTransitionAudio).length : 0
  if (!options.force && (cueCount > 0 || transitionCount > 0)) {
    throw new Error(
      `${standardKey} already contains TTS data (tts_cues=${cueCount}, transition_audio_urls=${transitionCount}). Re-run with --force only after reviewing it.`
    )
  }
}

function mergeStandard(currentStandard, update) {
  const nextStandard = {
    ...currentStandard,
    tts_cues: update.tts_cues
  }
  if (update.transition_audio_urls) {
    nextStandard.transition_audio_urls = update.transition_audio_urls
  } else {
    delete nextStandard.transition_audio_urls
  }
  return nextStandard
}

async function readStandard(update) {
  const standardKey = standardKeyFromUrl(update.standard_data_url, uploadConfig.publicBaseUrl)
  const result = await getObject({
    Bucket: uploadConfig.bucket,
    Region: uploadConfig.region,
    Key: standardKey
  })
  let standard
  try {
    standard = JSON.parse(toBuffer(result.Body, standardKey).toString('utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown JSON error'
    throw new Error(`${standardKey} is not valid JSON: ${message}`)
  }
  if (!isRecord(standard)) throw new Error(`${standardKey} is not a JSON object.`)
  return { standardKey, standard }
}

const root = resolve(process.cwd())
const fileEnvironment = loadEnv('', root, '')
const environment = {
  ...fileEnvironment,
  ...process.env,
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

const planPath = resolve(options.plan)
const audioDirectory = resolve(options.audio)
const plan = JSON.parse(await readFile(planPath, 'utf8'))
validatePlan(plan, uploadConfig.publicBaseUrl)

const audioFiles = await Promise.all(plan.tracks.map(async track => {
  const localPath = resolve(audioDirectory, track.key)
  const relativePath = relative(audioDirectory, localPath)
  if (relativePath.startsWith('..') || relativePath.includes('..' + '/')) {
    throw new Error(`Audio key resolves outside the selected directory: ${track.key}`)
  }
  const localStat = await stat(localPath)
  if (!localStat.isFile() || localStat.size <= 0) {
    throw new Error(`Audio asset is missing or empty: ${localPath}`)
  }
  return { key: track.key, localPath, byteSize: localStat.size }
}))

console.log(`Validated ${plan.updates.length} standard updates and ${audioFiles.length} audio assets.`)
console.log(`Mode: ${options.dryRun ? 'dry run' : 'publish'}`)

let inspectedStandards = 0
await mapConcurrent(plan.updates, 6, async update => {
  const { standardKey, standard } = await readStandard(update)
  assertNoExistingGuidance(standard, standardKey)
  inspectedStandards += 1
  if (inspectedStandards % 25 === 0 || inspectedStandards === plan.updates.length) {
    console.log(`Preflight checked ${inspectedStandards}/${plan.updates.length} standards`)
  }
})

const report = {
  schema_version: 'guidance-tts-publish-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  action_count: plan.updates.length,
  audio_asset_count: audioFiles.length,
  audio_byte_size: audioFiles.reduce((total, file) => total + file.byteSize, 0),
  standard_updates_written: 0
}

if (options.publish) {
  let uploadedAssets = 0
  await mapConcurrent(audioFiles, 6, async asset => {
    const body = await readFile(asset.localPath)
    await putObject({
      Bucket: uploadConfig.bucket,
      Region: uploadConfig.region,
      Key: asset.key,
      Body: body,
      ContentLength: asset.byteSize,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable'
    })
    uploadedAssets += 1
    if (uploadedAssets % 50 === 0 || uploadedAssets === audioFiles.length) {
      console.log(`Uploaded ${uploadedAssets}/${audioFiles.length} audio assets`)
    }
  })

  let writtenStandards = 0
  await mapConcurrent(plan.updates, 4, async update => {
    const { standardKey, standard } = await readStandard(update)
    assertNoExistingGuidance(standard, standardKey)
    const nextStandard = mergeStandard(standard, update)
    const body = Buffer.from(`${JSON.stringify(nextStandard, null, 2)}\n`, 'utf8')
    await putObject({
      Bucket: uploadConfig.bucket,
      Region: uploadConfig.region,
      Key: standardKey,
      Body: body,
      ContentLength: body.length,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-cache'
    })
    const verification = await readStandard(update)
    if (
      !sameJson(verification.standard.tts_cues, update.tts_cues)
      || !sameJson(verification.standard.transition_audio_urls, update.transition_audio_urls)
    ) {
      throw new Error(`Read-back verification failed for ${standardKey}`)
    }
    writtenStandards += 1
    if (writtenStandards % 25 === 0 || writtenStandards === plan.updates.length) {
      console.log(`Wrote and verified ${writtenStandards}/${plan.updates.length} standards`)
    }
  })
  report.standard_updates_written = writtenStandards
}

if (options.report) {
  await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

console.log(
  `${options.dryRun ? 'Dry run passed' : 'Published'}: ${report.action_count} standards, ${report.audio_asset_count} audio assets, ${report.audio_byte_size} bytes.`
)
