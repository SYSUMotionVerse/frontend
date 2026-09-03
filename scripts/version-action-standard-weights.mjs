import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { loadEnv } from 'vite'
import { resolveCosUploadConfig } from './cos-upload-config.mjs'

const options = {
  plan: '',
  out: '',
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

if (!options.plan || !options.out || options.dryRun === options.publish) {
  throw new Error(
    'Usage: node scripts/version-action-standard-weights.mjs --plan <plan.json> --out <url-map.json> (--dry-run | --publish)'
  )
}

const allAngleNames = [
  'left_elbow',
  'right_elbow',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'torso_rotation'
]

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

function finiteNumber(value) {
  if (typeof value === 'boolean') return Number.NaN
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

function weightConfigurationsMatch(actual, expected) {
  if (!isRecord(actual?.body_region_weights) || !sameJson(actual.body_region_weights, expected.body_region_weights)) {
    return false
  }
  if (!isRecord(actual.angle_rules)) return false
  return allAngleNames.every(name => {
    const actualRule = actual.angle_rules[name]
    const expectedRule = expected.angle_rules[name]
    return isRecord(actualRule)
      && isRecord(expectedRule)
      && actualRule.enabled === expectedRule.enabled
      && finiteNumber(actualRule.weight) === finiteNumber(expectedRule.weight)
  })
}

function validateWeightPlan(plan) {
  if (
    plan?.schema_version !== 'action-standard-weight-plan-v1'
    || !Array.isArray(plan.actions)
    || !Array.isArray(plan.standards)
  ) {
    throw new Error('Unexpected action-standard weight plan format.')
  }
  if (plan.action_count !== plan.actions.length || plan.standard_count !== plan.standards.length) {
    throw new Error('Action-standard weight plan count does not match its contents.')
  }

  const standardsByUrl = new Map()
  for (const standard of plan.standards) {
    if (
      !isRecord(standard)
      || typeof standard.action_id !== 'string'
      || typeof standard.source_key !== 'string'
      || typeof standard.target_key !== 'string'
      || typeof standard.expected_standard_data_url !== 'string'
      || typeof standard.standard_data_url !== 'string'
      || !isRecord(standard.body_region_weights)
      || !isRecord(standard.angle_rules)
    ) {
      throw new Error('Plan contains an invalid standard update.')
    }
    if (
      !/^actions\/[0-9a-f-]{36}\/standard-guidance-tts-v\d+\.json$/i.test(standard.source_key)
      || !/^actions\/[0-9a-f-]{36}\/standard-guidance-tts-v\d+\.json$/i.test(standard.target_key)
      || !standard.expected_standard_data_url.startsWith('https://')
      || !standard.standard_data_url.startsWith('https://')
      || standard.source_key === standard.target_key
    ) {
      throw new Error(`Plan contains an invalid standard location for ${standard.action_id}.`)
    }
    if (standardsByUrl.has(standard.expected_standard_data_url)) {
      throw new Error(`Plan contains duplicate standard ${standard.expected_standard_data_url}.`)
    }
    if (
      standard.body_region_weights.unit !== 'percent'
      || ['upper_body', 'core', 'lower_body'].some(name => !Number.isFinite(finiteNumber(standard.body_region_weights[name])))
    ) {
      throw new Error(`Plan contains invalid body-region weights for ${standard.action_id}.`)
    }
    const total = ['upper_body', 'core', 'lower_body'].reduce(
      (sum, name) => sum + finiteNumber(standard.body_region_weights[name]),
      0
    )
    if (Math.abs(total - 100) > 1e-9) {
      throw new Error(`Plan body-region weights for ${standard.action_id} total ${total}, expected 100.`)
    }
    for (const name of allAngleNames) {
      const rule = standard.angle_rules[name]
      if (!isRecord(rule) || typeof rule.enabled !== 'boolean' || !Number.isFinite(finiteNumber(rule.weight))) {
        throw new Error(`Plan contains an invalid ${name} rule for ${standard.action_id}.`)
      }
    }
    const angleTotal = allAngleNames.reduce(
      (sum, name) => sum + finiteNumber(standard.angle_rules[name].weight),
      0
    )
    if (Math.abs(angleTotal - 100) > 1e-9) {
      throw new Error(`Plan angle weights for ${standard.action_id} total ${angleTotal}, expected 100.`)
    }
    standardsByUrl.set(standard.expected_standard_data_url, standard)
  }

  const videoIds = new Set()
  for (const action of plan.actions) {
    if (
      !isRecord(action)
      || !Number.isInteger(action.video_id)
      || typeof action.key !== 'string'
      || typeof action.expected_standard_data_url !== 'string'
      || typeof action.standard_data_url !== 'string'
      || !standardsByUrl.has(action.expected_standard_data_url)
    ) {
      throw new Error('Plan contains an invalid database URL update.')
    }
    if (videoIds.has(action.video_id)) throw new Error(`Plan contains duplicate video ID ${action.video_id}.`)
    videoIds.add(action.video_id)
    const standard = standardsByUrl.get(action.expected_standard_data_url)
    if (action.standard_data_url !== standard.standard_data_url) {
      throw new Error(`Plan target URL does not match its standard for ${action.key}.`)
    }
  }
  return standardsByUrl
}

function hasExistingAngleWeight(standard) {
  if (!isRecord(standard.angle_rules)) return true
  return Object.values(standard.angle_rules).some(rule => (
    isRecord(rule) && Object.hasOwn(rule, 'weight')
  ))
}

function mergeWeights(source, standardPlan) {
  if (!isRecord(source.angle_rules)) {
    throw new Error(`${standardPlan.source_key} has an invalid angle_rules object.`)
  }
  if (hasExistingAngleWeight(source)) {
    throw new Error(`${standardPlan.source_key} already has angle weights; refusing to overwrite them.`)
  }
  if (source.body_region_weights !== undefined) {
    throw new Error(`${standardPlan.source_key} already has body_region_weights; refusing to overwrite them.`)
  }

  const angleRules = { ...source.angle_rules }
  for (const name of allAngleNames) {
    angleRules[name] = {
      ...(isRecord(angleRules[name]) ? angleRules[name] : {}),
      enabled: standardPlan.angle_rules[name].enabled,
      weight: standardPlan.angle_rules[name].weight
    }
  }
  return {
    ...source,
    angle_rules: angleRules,
    body_region_weights: standardPlan.body_region_weights
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
validateWeightPlan(plan)

let completed = 0
let alreadyVersioned = 0
await mapConcurrent(plan.standards, 4, async standardPlan => {
  const source = parseJsonObject(await getObject(standardPlan.source_key), standardPlan.source_key)
  if (source.action_id !== standardPlan.action_id) {
    throw new Error(`${standardPlan.source_key} action_id does not match its path.`)
  }
  if (
    source.action_type !== 'repetitive'
    || source.angle_unit !== 'radian'
    || !Array.isArray(source.standard_sequence)
    || source.standard_sequence.length === 0
    || !Array.isArray(source.angle_names)
    || allAngleNames.some(name => !source.angle_names.includes(name))
  ) {
    throw new Error(`${standardPlan.source_key} is not a complete repetitive action standard.`)
  }

  const existingTarget = await getObjectIfExists(standardPlan.target_key)
  if (existingTarget) {
    const target = parseJsonObject(existingTarget, standardPlan.target_key)
    if (target.action_id !== standardPlan.action_id || !weightConfigurationsMatch(target, standardPlan)) {
      throw new Error(`${standardPlan.target_key} already exists with different action weights.`)
    }
    alreadyVersioned += 1
  } else {
    const nextStandard = mergeWeights(source, standardPlan)
    if (options.publish) {
      const body = Buffer.from(`${JSON.stringify(nextStandard, null, 2)}\n`, 'utf8')
      await putObject(standardPlan.target_key, body)
      const verification = parseJsonObject(await getObject(standardPlan.target_key), standardPlan.target_key)
      if (verification.action_id !== standardPlan.action_id || !weightConfigurationsMatch(verification, standardPlan)) {
        throw new Error(`Read-back verification failed for ${standardPlan.target_key}.`)
      }
    }
  }

  completed += 1
  if (completed % 25 === 0 || completed === plan.standards.length) {
    console.log(`${options.dryRun ? 'Validated' : 'Versioned'} ${completed}/${plan.standards.length} standards`)
  }
})

const mapping = {
  schema_version: 'guidance-tts-standard-url-map-v1',
  generated_at: new Date().toISOString(),
  source: 'action-standard-weight-plan-v1',
  action_count: plan.actions.length,
  standard_count: plan.standards.length,
  target_version: plan.target_version,
  updates: plan.actions
    .map(action => ({
      video_id: action.video_id,
      key: action.key,
      expected_standard_data_url: action.expected_standard_data_url,
      standard_data_url: action.standard_data_url
    }))
    .sort((left, right) => left.key.localeCompare(right.key))
}
await writeFile(resolve(options.out), `${JSON.stringify(mapping, null, 2)}\n`, 'utf8')
console.log(
  `${options.dryRun ? 'Dry run passed' : 'Versioned'}: ${plan.action_count} actions, ${plan.standard_count} standards, ${alreadyVersioned} existing targets reused.`
)
