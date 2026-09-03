import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const options = {
  plan: '',
  out: '',
  voice: 'Tingting',
  rate: '300',
  concurrency: '4',
  force: false
}

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]
  if (argument === '--force') {
    options.force = true
    continue
  }
  if (!argument?.startsWith('--')) continue
  const key = argument.slice(2)
  const value = process.argv[index + 1]
  if (key in options && key !== 'force' && value) {
    options[key] = value
    index += 1
  }
}

if (!options.plan || !options.out) {
  throw new Error(
    'Usage: node scripts/render-guidance-tts.mjs --plan <plan.json> --out <directory> [--voice Tingting] [--rate 300] [--concurrency 4] [--force]'
  )
}

const voiceRate = Number(options.rate)
const concurrency = Number(options.concurrency)
if (!Number.isFinite(voiceRate) || voiceRate <= 0) {
  throw new Error('--rate must be a positive number')
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
  throw new Error('--concurrency must be an integer between 1 and 8')
}

function run(command, argumentsList) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', value => {
      stderr += value
    })
    child.on('error', rejectPromise)
    child.on('close', code => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`${command} exited with ${code}: ${stderr.trim()}`))
    })
  })
}

function commandOutput(command, argumentsList) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', value => {
      stdout += value
    })
    child.stderr.on('data', value => {
      stderr += value
    })
    child.on('error', rejectPromise)
    child.on('close', code => {
      if (code === 0) {
        resolvePromise(stdout.trim())
        return
      }
      rejectPromise(new Error(`${command} exited with ${code}: ${stderr.trim()}`))
    })
  })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function mapConcurrent(values, callback) {
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

function phraseHash(text) {
  return createHash('sha256')
    .update(`${options.voice}\u0000${voiceRate}\u0000${text}`)
    .digest('hex')
}

function atempoFilters(speed) {
  const filters = []
  let remaining = speed
  while (remaining > 2) {
    filters.push('atempo=2')
    remaining /= 2
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5')
    remaining /= 0.5
  }
  if (Math.abs(remaining - 1) > 0.001) {
    filters.push(`atempo=${remaining.toFixed(5)}`)
  }
  return filters
}

async function audioDuration(path) {
  const output = await commandOutput('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nokey=1:noprint_wrappers=1',
    path
  ])
  const duration = Number(output)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Cannot read audio duration: ${path}`)
  }
  return duration
}

const plan = JSON.parse(await readFile(resolve(options.plan), 'utf8'))
if (!Array.isArray(plan.tracks)) {
  throw new Error('Plan is missing tracks')
}

const outputDirectory = resolve(options.out)
const phraseDirectory = join(outputDirectory, '.phrases')
await mkdir(phraseDirectory, { recursive: true })

const phrases = new Map()
for (const track of plan.tracks) {
  for (const cue of track.cues) {
    if (!phrases.has(cue.text)) {
      phrases.set(cue.text, {
        text: cue.text,
        path: join(phraseDirectory, `${phraseHash(cue.text)}.aiff`)
      })
    }
  }
}

const phraseEntries = [...phrases.values()]
let renderedPhrases = 0
await mapConcurrent(phraseEntries, async phrase => {
  if (!options.force && await exists(phrase.path)) return
  await mkdir(dirname(phrase.path), { recursive: true })
  await run('say', ['-v', options.voice, '-r', String(voiceRate), '-o', phrase.path, phrase.text])
  renderedPhrases += 1
})

const phraseDurations = new Map()
await mapConcurrent(phraseEntries, async phrase => {
  phraseDurations.set(phrase.text, await audioDuration(phrase.path))
})

async function renderTrack(track) {
  const allowedKey = track.key.startsWith('actions/') || track.key.startsWith('shared/tts/guidance-v1/')
  if (!allowedKey || track.key.includes('..')) {
    throw new Error(`Unsafe audio key: ${track.key}`)
  }
  if (!Number.isFinite(track.duration_seconds) || track.duration_seconds <= 0) {
    throw new Error(`Invalid duration for ${track.key}`)
  }

  const targetPath = join(outputDirectory, track.key)
  if (!options.force && await exists(targetPath)) {
    return {
      key: track.key,
      duration_seconds: await audioDuration(targetPath),
      skipped: true,
      compressed_cues: 0
    }
  }

  if (track.type === 'silence') {
    if (!Array.isArray(track.cues) || track.cues.length !== 0) {
      throw new Error(`Silence track must not contain cues: ${track.key}`)
    }
    await mkdir(dirname(targetPath), { recursive: true })
    await run('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
      '-t', String(track.duration_seconds),
      '-ac', '1',
      '-ar', '44100',
      '-c:a', 'libmp3lame',
      '-b:a', '48k',
      targetPath
    ])
    return {
      key: track.key,
      duration_seconds: await audioDuration(targetPath),
      skipped: false,
      compressed_cues: 0,
      byte_size: (await stat(targetPath)).size
    }
  }
  if (!Array.isArray(track.cues) || track.cues.length === 0) {
    throw new Error(`Track has no cues: ${track.key}`)
  }

  await mkdir(dirname(targetPath), { recursive: true })
  const scratchDirectory = join(tmpdir(), `sport-snack-tts-${process.pid}-${createHash('sha1').update(track.key).digest('hex').slice(0, 8)}`)
  await rm(scratchDirectory, { recursive: true, force: true })
  await mkdir(scratchDirectory, { recursive: true })

  try {
    const filters = []
    const inputArguments = [
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=mono:sample_rate=44100`
    ]
    let compressedCues = 0

    track.cues.forEach((cue, index) => {
      const nextTime = track.cues[index + 1]?.time ?? track.duration_seconds
      const availableSeconds = nextTime - cue.time - 0.12
      if (availableSeconds <= 0) {
        throw new Error(`Overlapping TTS cue schedule in ${track.key}`)
      }
      const sourceDuration = phraseDurations.get(cue.text)
      if (!sourceDuration) throw new Error(`Missing phrase: ${cue.text}`)
      const speed = Math.max(1, sourceDuration / availableSeconds)
      if (speed > 1.001) compressedCues += 1
      const inputIndex = index + 1
      inputArguments.push('-i', phrases.get(cue.text).path)
      const transforms = [
        ...atempoFilters(speed),
        `adelay=${Math.round(cue.time * 1000)}:all=1`
      ]
      filters.push(`[${inputIndex}:a]${transforms.join(',')}[cue${index}]`)
    })

    const mixedInputs = ['[0:a]', ...track.cues.map((_, index) => `[cue${index}]`)].join('')
    filters.push(`${mixedInputs}amix=inputs=${track.cues.length + 1}:duration=first:dropout_transition=0[audio]`)

    await run('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      ...inputArguments,
      '-filter_complex', filters.join(';'),
      '-map', '[audio]',
      '-t', String(track.duration_seconds),
      '-ac', '1',
      '-ar', '44100',
      '-c:a', 'libmp3lame',
      '-b:a', '48k',
      targetPath
    ])

    return {
      key: track.key,
      duration_seconds: await audioDuration(targetPath),
      skipped: false,
      compressed_cues: compressedCues,
      byte_size: (await stat(targetPath)).size
    }
  } finally {
    await rm(scratchDirectory, { recursive: true, force: true })
  }
}

let completedTracks = 0
const reportTracks = await mapConcurrent(plan.tracks, async track => {
  const report = await renderTrack(track)
  completedTracks += 1
  if (completedTracks % 20 === 0 || completedTracks === plan.tracks.length) {
    console.log(`Rendered ${completedTracks}/${plan.tracks.length} tracks`)
  }
  return report
})

const report = {
  schema_version: 'guidance-tts-render-report-v1',
  generated_at: new Date().toISOString(),
  voice: options.voice,
  rate: voiceRate,
  tracks: reportTracks,
  rendered_phrase_count: renderedPhrases,
  unique_phrase_count: phraseEntries.length,
  total_byte_size: reportTracks.reduce((total, track) => total + (track.byte_size ?? 0), 0)
}
await writeFile(
  join(outputDirectory, 'render-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
)

console.log(
  `Rendered ${reportTracks.length} tracks with ${report.unique_phrase_count} unique phrases to ${outputDirectory}`
)
