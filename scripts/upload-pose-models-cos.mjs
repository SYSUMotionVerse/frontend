import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { loadEnv } from 'vite'
import { poseModelFiles, resolveCosUploadConfig } from './cos-upload-config.mjs'

const root = resolve(process.cwd())
const fileEnvironment = loadEnv('', root, '')
const environment = {
  ...fileEnvironment,
  ...process.env,
}

const uploadConfig = resolveCosUploadConfig(environment)
const { missing } = uploadConfig
if (missing.length > 0) {
  console.error(`Missing COS configuration: ${missing.join(', ')}`)
  process.exit(1)
}

const { region, bucket, publicBaseUrl, version, prefix } = uploadConfig
const sourceDirectory = resolve(root, 'models/pose')

const client = new COS({
  SecretId: environment.COS_SECRET_ID.trim(),
  SecretKey: environment.COS_SECRET_KEY.trim(),
})

function putObject(options) {
  return new Promise((resolvePromise, rejectPromise) => {
    client.putObject(options, (error, result) => {
      if (error) {
        rejectPromise(error)
        return
      }
      resolvePromise(result)
    })
  })
}

for (const modelFile of poseModelFiles) {
  const localPath = resolve(sourceDirectory, modelFile)
  const localStat = await stat(localPath)
  if (!localStat.isFile()) {
    throw new Error(`Model asset is not a file: ${localPath}`)
  }

  const data = await readFile(localPath)
  const objectKey = `${prefix}/${version}/${relative(sourceDirectory, localPath).split(sep).join('/')}`
  const contentType = modelFile.endsWith('.json')
    ? 'application/json; charset=utf-8'
    : 'application/octet-stream'

  await putObject({
    Bucket: bucket,
    Region: region,
    Key: objectKey,
    Body: data,
    ContentLength: localStat.size,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  })

  const checksum = createHash('sha256').update(data).digest('hex')
  console.log(
    `${objectKey} ${localStat.size} bytes sha256=${checksum} ${publicBaseUrl}/${objectKey}`,
  )
}

console.log(`POSE_MODEL_VERSION=${version}`)
console.log(
  `VITE_POSE_MODEL_BASE_URL=${publicBaseUrl}/${prefix}/${version}`,
)
