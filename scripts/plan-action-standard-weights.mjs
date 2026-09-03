import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const options = {
  bodyweight: '',
  traditional: '',
  videos: '',
  out: '',
  version: 'guidance-tts-v2'
}

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]
  if (!argument?.startsWith('--')) continue
  const key = argument.slice(2)
  const value = process.argv[index + 1]
  if (key in options && value) {
    options[key] = value
    index += 1
  }
}

if (!options.bodyweight || !options.traditional || !options.videos || !options.out) {
  throw new Error(
    'Usage: node scripts/plan-action-standard-weights.mjs --bodyweight <docx> --traditional <docx> --videos <exercise-videos.json> --out <plan.json> [--version guidance-tts-v2]'
  )
}
if (!/^guidance-tts-v\d+$/.test(options.version)) {
  throw new Error('--version must use the form guidance-tts-v<number>.')
}

const upperBodyAngles = [
  'left_elbow',
  'right_elbow',
  'left_shoulder',
  'right_shoulder'
]
const lowerBodyAngles = [
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee'
]
const allAngleNames = [...upperBodyAngles, ...lowerBodyAngles, 'torso_rotation']

function nodeText(node) {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (!node || typeof node !== 'object') return ''

  switch (node.t) {
    case 'Str':
      return node.c
    case 'Space':
      return ' '
    case 'SoftBreak':
    case 'LineBreak':
      return '\n'
    case 'Image':
    case 'Note':
      return ''
    case 'Link':
      return nodeText(node.c?.[1])
    default:
      return nodeText(node.c)
  }
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeActionName(value) {
  return value
    .normalize('NFKC')
    .replace(/^\s*\d+\s*[.、．]?\s*/, '')
    .replace(/^(?:热身|自重抗阻ES|自重抗阻|传统武术|传统体育养生动作|拉伸放松|拉伸)\s*[:：]?\s*/i, '')
    .replace(/[“”"'‘’]/g, '')
    .replace(/[＋+]/g, '')
    .replace(/加/g, '')
    .replace(/[、，,：:（）()\s]/g, '')
    .toLowerCase()
}

function tableRows(documentPath) {
  const parsed = JSON.parse(execFileSync(
    'pandoc',
    ['--track-changes=all', documentPath, '-t', 'json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ))

  return parsed.blocks
    .filter(block => block.t === 'Table')
    .flatMap(table => table.c[4])
    .flatMap(body => body[3])
    .map(row => row[1].map(cell => normalizeText(nodeText(cell[4]))))
}

function parseBodyRegionWeights(value, document, sequence) {
  const match = normalizeText(value).match(
    /上肢\s*(\d+(?:\.\d+)?)%\s*[｜|]\s*核心\s*(\d+(?:\.\d+)?)%\s*[｜|]\s*下肢\s*(\d+(?:\.\d+)?)%/
  )
  if (!match) {
    throw new Error(`${document} 第 ${sequence} 个动作缺少“上肢｜核心｜下肢”权重。`)
  }

  const weights = {
    upper_body: Number(match[1]),
    core: Number(match[2]),
    lower_body: Number(match[3]),
    unit: 'percent'
  }
  const total = weights.upper_body + weights.core + weights.lower_body
  if (!Number.isFinite(total) || Math.abs(total - 100) > 1e-9) {
    throw new Error(`${document} 第 ${sequence} 个动作的三类权重之和为 ${total}，预期为 100。`)
  }
  return weights
}

function actionName(value) {
  return normalizeText(value)
    .replace(/【[^】]+】/g, '')
    .replace(/上肢\s*\d+(?:\.\d+)?%\s*[｜|]\s*核心\s*\d+(?:\.\d+)?%\s*[｜|]\s*下肢\s*\d+(?:\.\d+)?%/g, '')
    .trim()
}

function extractDocumentActions({ documentPath, exerciseType, document }) {
  const actions = []
  for (const row of tableRows(documentPath)) {
    const sequence = Number(row[0]?.match(/^\d+/)?.[0])
    if (!Number.isInteger(sequence)) continue

    const nameCell = row[1] ?? ''
    const name = actionName(nameCell)
    if (!name) throw new Error(`${document} 第 ${sequence} 个动作缺少名称。`)

    actions.push({
      key: `${exerciseType}:${sequence}`,
      document,
      exercise_type: exerciseType,
      sequence,
      action_name: name,
      body_region_weights: parseBodyRegionWeights(nameCell, document, sequence)
    })
  }

  const expected = Array.from({ length: actions.length }, (_, index) => index + 1)
  if (actions.map(action => action.sequence).join(',') !== expected.join(',')) {
    throw new Error(`${document} 的动作序号不是连续的。`)
  }
  return actions
}

function targetSequence(title) {
  const match = title.match(/^\s*(\d+)\s*[.、．]/)
  return match ? Number(match[1]) : Number.NaN
}

function sourceDetails(url) {
  const parsedUrl = new URL(url)
  const match = parsedUrl.pathname.match(
    /^\/actions\/([0-9a-f-]{36})\/standard-guidance-tts-v(\d+)\.json$/i
  )
  if (!match) {
    throw new Error(`Unsupported current standard URL: ${url}`)
  }
  return {
    action_id: match[1],
    source_version: `guidance-tts-v${match[2]}`,
    source_key: decodeURIComponent(parsedUrl.pathname).replace(/^\//, ''),
    target_key: `actions/${match[1]}/standard-${options.version}.json`,
    target_url: `${parsedUrl.origin}/actions/${match[1]}/standard-${options.version}.json`
  }
}

function angleRules(bodyRegionWeights) {
  const weights = {}
  const upperWeight = bodyRegionWeights.upper_body / upperBodyAngles.length
  const lowerWeight = bodyRegionWeights.lower_body / lowerBodyAngles.length

  for (const name of upperBodyAngles) weights[name] = upperWeight
  for (const name of lowerBodyAngles) weights[name] = lowerWeight
  weights.torso_rotation = bodyRegionWeights.core

  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  if (Math.abs(total - 100) > 1e-9) {
    throw new Error(`Mapped angle weights total ${total}, expected 100.`)
  }

  return Object.fromEntries(allAngleNames.map(name => [name, {
    enabled: weights[name] > 0,
    weight: weights[name]
  }]))
}

const documents = [
  ...extractDocumentActions({
    documentPath: options.bodyweight,
    exerciseType: 'HIIT',
    document: '自重抗阻动作.docx'
  }),
  ...extractDocumentActions({
    documentPath: options.traditional,
    exerciseType: 'MARTIAL_ARTS',
    document: '传统体育养生动作.docx'
  })
]
const videos = JSON.parse(await readFile(resolve(options.videos), 'utf8'))
if (!Array.isArray(videos)) throw new Error('Video inventory must be an array.')

const videosByKey = new Map()
for (const video of videos) {
  if (!video?.is_active || typeof video.title !== 'string' || typeof video.standard_data_url !== 'string') {
    throw new Error('Video inventory contains an invalid active video.')
  }
  const sequence = targetSequence(video.title)
  const key = `${video.exercise_type}:${sequence}`
  if (!Number.isInteger(sequence)) throw new Error(`Cannot infer action sequence from database title: ${video.title}`)
  if (videosByKey.has(key)) throw new Error(`Duplicate active video sequence: ${key}`)
  videosByKey.set(key, video)
}

if (documents.length !== videos.length) {
  throw new Error(`Document actions (${documents.length}) do not match active videos (${videos.length}).`)
}

const actions = documents.map(action => {
  const video = videosByKey.get(action.key)
  if (!video) throw new Error(`No active database video for ${action.key}.`)
  const source = sourceDetails(video.standard_data_url)
  return {
    ...action,
    video_id: video.id,
    database_title: video.title,
    database_name_matches_document: normalizeActionName(video.title) === normalizeActionName(action.action_name),
    expected_standard_data_url: video.standard_data_url,
    standard_data_url: source.target_url,
    ...source,
    angle_rules: angleRules(action.body_region_weights)
  }
})

const grouped = new Map()
for (const action of actions) {
  const current = grouped.get(action.expected_standard_data_url) ?? []
  current.push(action)
  grouped.set(action.expected_standard_data_url, current)
}

const standards = [...grouped.values()].map(group => {
  const [first] = group
  const expectedBodyWeights = JSON.stringify(first.body_region_weights)
  if (group.some(action => JSON.stringify(action.body_region_weights) !== expectedBodyWeights)) {
    throw new Error(
      `The shared standard ${first.expected_standard_data_url} has conflicting document weights: ${group.map(action => action.key).join(', ')}.`
    )
  }
  return {
    action_id: first.action_id,
    source_key: first.source_key,
    target_key: first.target_key,
    expected_standard_data_url: first.expected_standard_data_url,
    standard_data_url: first.standard_data_url,
    body_region_weights: first.body_region_weights,
    angle_rules: first.angle_rules,
    action_keys: group.map(action => action.key).sort(),
    video_ids: group.map(action => action.video_id).sort((left, right) => left - right)
  }
}).sort((left, right) => left.source_key.localeCompare(right.source_key))

const plan = {
  schema_version: 'action-standard-weight-plan-v1',
  generated_at: new Date().toISOString(),
  source_documents: [options.bodyweight, options.traditional],
  target_version: options.version,
  action_count: actions.length,
  standard_count: standards.length,
  actions,
  standards,
  name_differences: actions
    .filter(action => !action.database_name_matches_document)
    .map(action => ({
      key: action.key,
      document_action_name: action.action_name,
      database_title: action.database_title
    }))
}

await writeFile(resolve(options.out), `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
console.log(`Wrote ${plan.action_count} action mappings for ${plan.standard_count} distinct standards to ${resolve(options.out)}`)
console.log(`Document/database name differences: ${plan.name_differences.length}`)
