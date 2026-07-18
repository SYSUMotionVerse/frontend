export interface ReleaseEnvironment {
  VITE_API_BASE_URL?: string
  VITE_POSE_MODEL_BASE_URL?: string
  VITE_POSE_MODEL_VERSION?: string
}

export function validateReleaseConfig(env?: ReleaseEnvironment): string[]
