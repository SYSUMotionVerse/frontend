import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const documentArguments = {
  bodyweight: '',
  traditional: '',
  out: ''
}

for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index]
  const value = process.argv[index + 1]
  if (!option?.startsWith('--') || !value) continue
  const key = option.slice(2)
  if (key in documentArguments) {
    documentArguments[key] = value
  }
}

if (
  !documentArguments.bodyweight
  || !documentArguments.traditional
  || !documentArguments.out
) {
  throw new Error(
    'Usage: node scripts/extract-guidance-tts.mjs --bodyweight <docx> --traditional <docx> --out <manifest.json>'
  )
}

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

function parseTimeLabel(label, durationSeconds) {
  const active = label.match(/^正式第(\d+)秒$/)
  if (active) return { phase: 'active', time: Number(active[1]) }

  const rest = label.match(/^休息第(\d+)秒$/)
  if (rest) return { phase: 'rest', time: Number(rest[1]) }

  const relative = label.match(/^第(\d+)秒$/)
  if (relative) return { phase: 'active', time: Number(relative[1]) }

  const absolute = label.match(/^第(\d+):(\d+)秒(?:（[^）]+）)?$/)
  if (!absolute) {
    throw new Error(`Unsupported guidance timing label: ${label}`)
  }

  const time = Number(absolute[1]) * 60 + Number(absolute[2])
  return {
    phase: time <= durationSeconds ? 'active' : 'timeline',
    time
  }
}

function parseGuidanceCues(value, durationSeconds) {
  const guidance = normalizeText(value)
  const expression = /((?:第\d+:\d+秒(?:（[^）]+）)?|正式第\d+秒|休息第\d+秒|第\d+秒))：/g
  const matches = [...guidance.matchAll(expression)]

  return matches.map((match, index) => {
    const textStart = match.index + match[0].length
    const textEnd = matches[index + 1]?.index ?? guidance.length
    const text = guidance.slice(textStart, textEnd).trim()
    if (!text) {
      throw new Error(`Empty guidance cue after ${match[1]}`)
    }
    return {
      ...parseTimeLabel(match[1], durationSeconds),
      source_timing: match[1],
      text
    }
  })
}

function actionName(value) {
  return normalizeText(value)
    .replace(/【[^】]+】/g, '')
    .replace(/上肢\d+%[｜|]核心\d+%[｜|]下肢\d+%/g, '')
    .trim()
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

function extractActions({ documentPath, exerciseType, label }) {
  const actions = []
  for (const row of tableRows(documentPath)) {
    const sequence = Number(row[0]?.match(/^\d+/)?.[0])
    if (!Number.isInteger(sequence)) continue

    const durationSeconds = Number(row[3]?.match(/\d+/)?.[0])
    const name = actionName(row[1] ?? '')
    const guidance = row[2] ?? ''
    if (!name || !Number.isFinite(durationSeconds) || !guidance) {
      throw new Error(`Incomplete ${label} action row ${sequence}`)
    }

    actions.push({
      document: label,
      exercise_type: exerciseType,
      sequence,
      action_name: name,
      duration_seconds: durationSeconds,
      cues: parseGuidanceCues(guidance, durationSeconds)
    })
  }

  const expectedSequence = Array.from({ length: actions.length }, (_, index) => index + 1)
  if (actions.map(action => action.sequence).join(',') !== expectedSequence.join(',')) {
    throw new Error(`${label} action sequence is not contiguous`)
  }
  return actions
}

const bodyweight = extractActions({
  documentPath: documentArguments.bodyweight,
  exerciseType: 'HIIT',
  label: '自重抗阻动作'
})
const traditional = extractActions({
  documentPath: documentArguments.traditional,
  exerciseType: 'MARTIAL_ARTS',
  label: '传统体育养生动作'
})

const manifest = {
  schema_version: 'guidance-tts-manifest-v1',
  generated_at: new Date().toISOString(),
  actions: [...bodyweight, ...traditional]
}

const outputPath = resolve(documentArguments.out)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const cueCounts = manifest.actions.reduce((counts, action) => {
  for (const cue of action.cues) {
    counts[cue.phase] = (counts[cue.phase] ?? 0) + 1
  }
  return counts
}, {})

console.log(`Wrote ${manifest.actions.length} actions to ${outputPath}`)
console.log(JSON.stringify(cueCounts))
