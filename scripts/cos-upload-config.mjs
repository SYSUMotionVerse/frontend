export const poseModelFiles = [
  'detector/model.json',
  'detector/group1-shard1of2.bin',
  'detector/group1-shard2of2.bin',
  'landmark_lite/model.json',
  'landmark_lite/group1-shard1of1.bin',
]

export function resolveCosUploadConfig(environment) {
  const required = [
    'COS_REGION',
    'COS_BUCKET',
    'COS_SECRET_ID',
    'COS_SECRET_KEY',
    'COS_PUBLIC_BASE_URL',
  ]
  const missing = required.filter((name) => !environment[name]?.trim())

  const publicBaseUrl = environment.COS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  if (publicBaseUrl) {
    const publicUrl = new URL(publicBaseUrl)
    if (publicUrl.protocol !== 'https:') {
      throw new Error('COS_PUBLIC_BASE_URL must use HTTPS')
    }
  }

  return {
    missing,
    region: environment.COS_REGION?.trim() ?? '',
    bucket: environment.COS_BUCKET?.trim() ?? '',
    publicBaseUrl,
    version: environment.POSE_MODEL_VERSION?.trim() || 'blazepose-lite-v1',
    prefix: (environment.COS_MODEL_PREFIX?.trim() || 'pose').replace(/^\/+|\/+$/g, ''),
  }
}
