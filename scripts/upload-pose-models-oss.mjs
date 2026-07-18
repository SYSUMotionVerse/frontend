import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import OSS from 'ali-oss'

const required = [
  'OSS_REGION',
  'OSS_BUCKET',
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
]
const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.error(`Missing OSS configuration: ${missing.join(', ')}`)
  process.exit(1)
}

const version = process.env.POSE_MODEL_VERSION || 'blazepose-lite-v1'
const prefix = (process.env.OSS_MODEL_PREFIX || 'pose').replace(
  /^\/+|\/+$/g,
  '',
)
const sourceDirectory = resolve(process.cwd(), 'models/pose')
const modelFiles = [
  'detector/model.json',
  'detector/group1-shard1of2.bin',
  'detector/group1-shard2of2.bin',
  'landmark_lite/model.json',
  'landmark_lite/group1-shard1of1.bin',
]

const client = new OSS({
  region: process.env.OSS_REGION,
  bucket: process.env.OSS_BUCKET,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  ...(process.env.OSS_ENDPOINT ? { endpoint: process.env.OSS_ENDPOINT } : {}),
  secure: true,
})

for (const modelFile of modelFiles) {
  const localPath = resolve(sourceDirectory, modelFile)
  const localStat = await stat(localPath)
  if (!localStat.isFile()) {
    throw new Error(`Model asset is not a file: ${localPath}`)
  }

  const objectName = `${prefix}/${version}/${relative(sourceDirectory, localPath).split(sep).join('/')}`
  const contentType = modelFile.endsWith('.json')
    ? 'application/json; charset=utf-8'
    : 'application/octet-stream'
  const result = await client.put(objectName, localPath, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
  const checksum = createHash('sha256')
    .update(await readFile(localPath))
    .digest('hex')
  console.log(
    `${objectName} ${localStat.size} bytes sha256=${checksum} ${result.url}`,
  )
}

console.log(`POSE_MODEL_VERSION=${version}`)
console.log(
  `VITE_POSE_MODEL_BASE_URL=https://<your-model-domain>/${prefix}/${version}`,
)
