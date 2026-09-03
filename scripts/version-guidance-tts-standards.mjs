import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { loadEnv } from 'vite'
import { resolveCosUploadConfig } from './cos-upload-config.mjs'

const options = {
  plan: '',
  out: '',
  version: 'guidance-tts-v1',
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

if (!options.plan || !options.out || options.dryRun === options.publish) {
  throw new Error(
    'Usage: node scripts/version-guidance-tts-standards.mjs --plan <plan.json> --out <url-map.json> (--dry-run | --publish) [--version guidance-tts-v1] [--force]'
  )
}
if (!/^[a-z0-9][a-z0-9-]*$/i.test(options.version)) {
  throw new Error('--version may contain only letters, digits, and hyphens.')
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
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

function getObject(key) {
  return callCos('getObject', {
    Bucket: uploadConfig.bucket,
    Region: uploadConfig.region,
    Key: key
  })
}

function putObject(key, body) {
  return callCos('putObject', {
    Bucket: uploadConfig.bucket,
    Region: uploadConfig.region,
    Key: key,
    Body: body,
    ContentLength: body.length,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-cache'
  })
}

async function getObjectIfExists(key) {
  try {
    return await getObject(key)
  } catch (error) {
    const statusCode = typeof error === 'object' && error ? error.statusCode : undefined
    const code = typeof error === 'object' && error ? error.code : undefined
    if (statusCode === 404 || code === 'NoSuchKey') return null
    throw error
  }
}

function parseJsonObject(result, key) {
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

function sourceDetails(url, publicBaseUrl) {
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
  const match = key.match(/^actions\/([0-9a-f-]{36})\/standard(?:-guidance-tts-v\d+)?\.json$/i)
  if (!match) throw new Error(`Unsupported standard object key: ${key}`)
  return {
    sourceKey: key,
    actionId: match[1],
    targetKey: `actions/${match[1]}/standard-${options.version}.json`,
    targetUrl: `${publicBaseUrl}/actions/${match[1]}/standard-${options.version}.json`
  }
}

function mergeGuidance(currentStandard, update) {
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

function adaptLegacyStandard(standard, actionId, objectKey) {
  const nextStandard = { ...standard }
  let adapted = false
  if (typeof nextStandard.action_id !== 'string' || nextStandard.action_id.trim().length === 0) {
    nextStandard.action_id = actionId
    adapted = true
  }
  if (nextStandard.action_type !== 'repetitive') {
    nextStandard.action_type = 'repetitive'
    adapted = true
  }
  if (nextStandard.angle_unit !== 'radian') {
    nextStandard.angle_unit = 'radian'
    adapted = true
  }
  if (!Array.isArray(nextStandard.standard_sequence) || nextStandard.standard_sequence.length === 0) {
    if (!Array.isArray(nextStandard.frames) || nextStandard.frames.length === 0) {
      throw new Error(`${objectKey} has neither standard_sequence nor legacy frames.`)
    }
    const sequence = nextStandard.frames.map((frame, index) => {
      if (!isRecord(frame) || !Array.isArray(frame.angles)) {
        throw new Error(`${objectKey} has an invalid legacy frame at index ${index}.`)
      }
      return frame.angles
    })
    nextStandard.standard_sequence = sequence
    adapted = true
  }
  if (!isRecord(nextStandard.angle_rules)) {
    nextStandard.angle_rules = {}
    adapted = true
  }
  if (!Array.isArray(nextStandard.angle_names) || nextStandard.angle_names.length === 0) {
    throw new Error(`${objectKey} has invalid angle_names.`)
  }
  return { standard: nextStandard, adapted }
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

const plan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
if (plan?.schema_version !== 'guidance-tts-plan-v1' || !Array.isArray(plan.updates)) {
  throw new Error('Unexpected guidance TTS plan format.')
}
if (plan.action_count !== plan.updates.length) {
  throw new Error('Plan action count does not match its updates.')
}

let completed = 0
let legacyAdapted = 0
const mappings = await mapConcurrent(plan.updates, 4, async update => {
  if (!isRecord(update) || !Array.isArray(update.tts_cues) || typeof update.standard_data_url !== 'string') {
    throw new Error('Plan contains an invalid standard update.')
  }
  const details = sourceDetails(update.standard_data_url, uploadConfig.publicBaseUrl)
  const source = parseJsonObject(await getObject(details.sourceKey), details.sourceKey)
  const merged = mergeGuidance(source, update)
  const normalized = adaptLegacyStandard(merged, details.actionId, details.sourceKey)
  if (normalized.adapted) legacyAdapted += 1

  const existingTarget = await getObjectIfExists(details.targetKey)
  if (existingTarget) {
    const target = parseJsonObject(existingTarget, details.targetKey)
    const matches = sameJson(target.tts_cues, update.tts_cues)
      && sameJson(target.transition_audio_urls, update.transition_audio_urls)
      && target.action_id === details.actionId
      && target.action_type === 'repetitive'
      && target.angle_unit === 'radian'
      && Array.isArray(target.standard_sequence)
      && isRecord(target.angle_rules)
    if (!matches && !options.force) {
      throw new Error(`${details.targetKey} already exists with different TTS data. Re-run with --force only after reviewing it.`)
    }
  }

  if (options.publish) {
    const body = Buffer.from(`${JSON.stringify(normalized.standard, null, 2)}\n`, 'utf8')
    await putObject(details.targetKey, body)
    const verification = parseJsonObject(await getObject(details.targetKey), details.targetKey)
    if (
      !sameJson(verification.tts_cues, update.tts_cues)
      || !sameJson(verification.transition_audio_urls, update.transition_audio_urls)
      || verification.action_id !== details.actionId
      || verification.action_type !== 'repetitive'
      || verification.angle_unit !== 'radian'
      || !Array.isArray(verification.standard_sequence)
      || !isRecord(verification.angle_rules)
    ) {
      throw new Error(`Read-back verification failed for ${details.targetKey}`)
    }
  }

  completed += 1
  if (completed % 25 === 0 || completed === plan.updates.length) {
    console.log(`${options.dryRun ? 'Validated' : 'Wrote'} ${completed}/${plan.updates.length} versioned standards`)
  }
  return {
    video_id: update.video_id,
    key: update.key,
    expected_standard_data_url: update.standard_data_url,
    standard_data_url: details.targetUrl
  }
})

const output = {
  schema_version: 'guidance-tts-standard-url-map-v1',
  generated_at: new Date().toISOString(),
  version: options.version,
  action_count: mappings.length,
  legacy_standard_count: legacyAdapted,
  updates: mappings.sort((left, right) => left.key.localeCompare(right.key))
}
const outputPath = resolve(options.out)
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(
  `${options.dryRun ? 'Dry run passed' : 'Versioned'}: ${output.action_count} standards, ${output.legacy_standard_count} legacy standards adapted.`
)
