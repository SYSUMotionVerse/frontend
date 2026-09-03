import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { loadEnv } from 'vite'
import { resolveCosUploadConfig } from './cos-upload-config.mjs'

const options = {
  inventory: '',
  report: '',
  dryRun: false,
  publish: false,
  includeStandards: false
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
  if (argument === '--include-standards') {
    options.includeStandards = true
    continue
  }
  if (!argument?.startsWith('--')) continue
  const key = argument.slice(2)
  const value = process.argv[index + 1]
  if (key in options && key !== 'dryRun' && key !== 'publish' && key !== 'includeStandards' && value) {
    options[key] = value
    index += 1
  }
}

if (!options.inventory || !options.report || options.dryRun === options.publish) {
  throw new Error(
    'Usage: node scripts/cleanup-legacy-guidance-tts.mjs --inventory <current-videos.json> --report <cleanup-report.json> (--dry-run | --publish) [--include-standards]'
  )
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

function headObject(key) {
  return callCos('headObject', {
    Bucket: uploadConfig.bucket,
    Region: uploadConfig.region,
    Key: key
  })
}

function deleteMultipleObject(objects) {
  return callCos('deleteMultipleObject', {
    Bucket: uploadConfig.bucket,
    Region: uploadConfig.region,
    Objects: objects.map(Key => ({ Key })),
    Quiet: true
  })
}

function toBuffer(value, context) {
  if (Buffer.isBuffer(value)) return value
  if (typeof value === 'string') return Buffer.from(value)
  if (value instanceof Uint8Array) return Buffer.from(value)
  throw new Error(`${context} did not return a readable body.`)
}

function keyFromPublicUrl(url, publicBaseUrl) {
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }
  const publicBase = new URL(publicBaseUrl)
  if (parsedUrl.origin !== publicBase.origin) return null
  const basePath = publicBase.pathname.replace(/\/+$/, '')
  if (basePath && !parsedUrl.pathname.startsWith(`${basePath}/`)) return null
  const key = decodeURIComponent(parsedUrl.pathname.slice(basePath.length)).replace(/^\/+/, '')
  return key || null
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

function collectAudioKeys(value, publicBaseUrl, target) {
  if (typeof value === 'string') {
    const key = keyFromPublicUrl(value, publicBaseUrl)
    if (key?.toLowerCase().endsWith('.mp3')) target.add(key)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectAudioKeys(item, publicBaseUrl, target))
    return
  }
  if (isRecord(value)) {
    Object.values(value).forEach(item => collectAudioKeys(item, publicBaseUrl, target))
  }
}

async function listObjects(prefix) {
  const objects = []
  let marker = ''
  while (true) {
    const result = await callCos('getBucket', {
      Bucket: uploadConfig.bucket,
      Region: uploadConfig.region,
      Prefix: prefix,
      ...(marker ? { Marker: marker } : {})
    })
    for (const item of result.Contents ?? []) {
      if (typeof item.Key === 'string') {
        objects.push({ key: item.Key, byteSize: Number(item.Size) || 0 })
      }
    }
    const isTruncated = result.IsTruncated === true || result.IsTruncated === 'true'
    if (!isTruncated) return objects
    if (typeof result.NextMarker !== 'string' || !result.NextMarker) {
      throw new Error(`COS object listing for ${prefix} returned an invalid continuation marker.`)
    }
    marker = result.NextMarker
  }
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

const videos = JSON.parse(await readFile(resolve(options.inventory), 'utf8'))
if (!Array.isArray(videos) || videos.length === 0) {
  throw new Error('Inventory must contain at least one active exercise video.')
}

const currentStandardKeys = new Set()
for (const video of videos) {
  if (!video?.is_active || typeof video.standard_data_url !== 'string') {
    throw new Error('Inventory contains an invalid active standard URL.')
  }
  const key = keyFromPublicUrl(video.standard_data_url, uploadConfig.publicBaseUrl)
  if (!key?.startsWith('actions/') || !/\/standard-guidance-tts-v\d+\.json$/.test(key)) {
    throw new Error(`Inventory contains an unsupported standard URL: ${video.standard_data_url}`)
  }
  if (currentStandardKeys.has(key)) throw new Error(`Inventory has a duplicate standard key: ${key}`)
  currentStandardKeys.add(key)
}

const referencedAudioKeys = new Set()
await mapConcurrent([...currentStandardKeys], 4, async standardKey => {
  const standard = parseStandard(await getObject(standardKey), standardKey)
  if (!Array.isArray(standard.tts_cues) || standard.tts_cues.length === 0) {
    throw new Error(`${standardKey} does not contain active TTS cues.`)
  }
  collectAudioKeys(standard, uploadConfig.publicBaseUrl, referencedAudioKeys)
})

const [actionObjects, sharedTtsObjects] = await Promise.all([
  listObjects('actions/'),
  listObjects('shared/tts/')
])
const actionKeys = actionObjects.map(object => object.key)
const sharedTtsKeys = sharedTtsObjects.map(object => object.key)
const standardKeyPattern = /^actions\/[0-9a-f-]{36}\/standard(?:-guidance-tts-v\d+)?\.json$/i
const actionAudioKeyPattern = /^actions\/[0-9a-f-]{36}\/tts\/.+\.mp3$/i
const sharedAudioKeyPattern = /^shared\/tts\/.+\.mp3$/i

const candidates = [
  ...actionKeys.filter(key => (
    (options.includeStandards && standardKeyPattern.test(key) && !currentStandardKeys.has(key))
    || (actionAudioKeyPattern.test(key) && !referencedAudioKeys.has(key))
  )),
  ...sharedTtsKeys.filter(key => sharedAudioKeyPattern.test(key) && !referencedAudioKeys.has(key))
].sort()

const duplicateCandidate = candidates.find((key, index) => index > 0 && candidates[index - 1] === key)
if (duplicateCandidate) throw new Error(`Cleanup candidate was listed twice: ${duplicateCandidate}`)
const unsafeCandidate = candidates.find(key => currentStandardKeys.has(key) || referencedAudioKeys.has(key))
if (unsafeCandidate) throw new Error(`Refusing to delete a currently referenced object: ${unsafeCandidate}`)

const byteSizeByKey = new Map(
  [...actionObjects, ...sharedTtsObjects].map(object => [object.key, object.byteSize])
)

const candidatesByKind = {
  standard_json: candidates.filter(key => standardKeyPattern.test(key)),
  action_audio: candidates.filter(key => actionAudioKeyPattern.test(key)),
  shared_audio: candidates.filter(key => sharedAudioKeyPattern.test(key))
}
const report = {
  schema_version: 'guidance-tts-cleanup-report-v1',
  generated_at: new Date().toISOString(),
  mode: options.dryRun ? 'dry-run' : 'publish',
  include_standards: options.includeStandards,
  current_standard_count: currentStandardKeys.size,
  referenced_audio_count: referencedAudioKeys.size,
  candidate_count: candidates.length,
  candidate_byte_size: candidates.reduce((total, key) => total + (byteSizeByKey.get(key) ?? 0), 0),
  candidates_by_kind: Object.fromEntries(
    Object.entries(candidatesByKind).map(([kind, keys]) => [kind, {
      count: keys.length,
      keys
    }])
  )
}

if (options.publish && candidates.length > 0) {
  const chunks = []
  for (let index = 0; index < candidates.length; index += 1000) {
    chunks.push(candidates.slice(index, index + 1000))
  }
  for (const chunk of chunks) {
    await deleteMultipleObject(chunk)
  }
  await mapConcurrent([...currentStandardKeys, ...referencedAudioKeys], 6, async key => {
    await headObject(key)
  })
}

await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(
  `${options.dryRun ? 'Dry run found' : 'Deleted'} ${report.candidate_count} unreferenced legacy objects (${report.candidate_byte_size} bytes).`
)
