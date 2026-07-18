export const poseModelFiles: readonly string[]

export interface CosUploadEnvironment {
  COS_REGION?: string
  COS_BUCKET?: string
  COS_SECRET_ID?: string
  COS_SECRET_KEY?: string
  COS_PUBLIC_BASE_URL?: string
  COS_MODEL_PREFIX?: string
  POSE_MODEL_VERSION?: string
}

export interface CosUploadConfig {
  missing: string[]
  region: string
  bucket: string
  publicBaseUrl: string
  version: string
  prefix: string
}

export function resolveCosUploadConfig(
  environment: CosUploadEnvironment
): CosUploadConfig
