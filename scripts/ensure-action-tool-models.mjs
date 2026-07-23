import { access, copyFile, mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { loadEnv } from 'vite'

const DEFAULT_ARCHIVE_URL =
  'https://github.com/SYSUMotionVerse/frontend/releases/download/action-tool-model-blazepose-lite-v1/blazepose-lite-v1.zip'
const projectRoot = resolve(import.meta.dirname, '..')
const targetRoot = resolve(
  projectRoot,
  process.env.ACTION_TOOL_MODEL_CACHE_DIR || '.tmp/action-tool-models'
)
const localFallbackRoot = resolve(projectRoot, 'models/pose')
const fileEnvironment = loadEnv('', projectRoot, '')
const environment = { ...fileEnvironment, ...process.env }
const files = [
  'detector/model.json',
  'detector/group1-shard1of2.bin',
  'detector/group1-shard2of2.bin',
  'landmark_lite/model.json',
  'landmark_lite/group1-shard1of1.bin'
]

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function cacheIsComplete() {
  for (const file of files) {
    const target = resolve(targetRoot, file)
    if (!await exists(target) || (await stat(target)).size === 0) return false
  }
  return true
}

async function copyLocalFallback() {
  if (!await exists(localFallbackRoot)) return false
  for (const file of files) {
    const source = resolve(localFallbackRoot, file)
    const target = resolve(targetRoot, file)
    if (!await exists(source)) return false
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
  }
  console.log('[action-tool] Using local models/pose fallback.')
  return true
}

async function downloadModels() {
  const archiveUrl = environment.VITE_POSE_MODEL_ARCHIVE_URL?.trim() || DEFAULT_ARCHIVE_URL
  console.log(`[action-tool] Downloading pose model archive from ${archiveUrl}`)
  const response = await fetch(archiveUrl)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} while fetching model archive`)
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()))
  for (const file of files) {
    const target = resolve(targetRoot, file)
    if (await exists(target) && (await stat(target)).size > 0) continue
    const body = archive[file] ?? archive[`pose/${file}`]
    if (!body) throw new Error(`model archive is missing ${file}`)
    const temporary = `${target}.download`
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, body)
    await rename(temporary, target)
  }
  console.log(`[action-tool] Pose model is ready at ${targetRoot}`)
}

try {
  if (!await cacheIsComplete()) {
    try {
      await downloadModels()
    } catch (error) {
      console.warn(`[action-tool] GitHub model download failed: ${error instanceof Error ? error.message : error}`)
      if (!await copyLocalFallback()) throw error
    }
  } else {
    console.log(`[action-tool] Reusing cached pose model at ${targetRoot}`)
  }
} catch (error) {
  console.error('[action-tool] Pose model is unavailable.')
  console.error('Check GitHub access, set VITE_POSE_MODEL_ARCHIVE_URL, or provide models/pose for an offline fallback.')
  console.error(error)
  process.exitCode = 1
}
