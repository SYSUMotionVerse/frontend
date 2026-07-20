export interface ReleaseEnvironment {
  VITE_API_BASE_URL?: string
  VITE_POSE_MODEL_BASE_URL?: string
  VITE_POSE_MODEL_VERSION?: string
  VITE_SHORT_QUESTIONNAIRE_ENDPOINT?: string
  CI?: string
  ALLOW_CI_RELEASE_PLACEHOLDERS?: string
}

export function validateReleaseConfig(env?: ReleaseEnvironment): string[]

export function validateShortQuestionnaireEndpoint(endpoint: string): string[]

export interface ProductionManifest {
  'mp-weixin'?: {
    appid?: string
    setting?: {
      urlCheck?: boolean
    }
  }
}

export function validateProductionManifest(manifest: unknown): string[]

export interface GeneratedProjectConfig {
  appid?: string
  setting?: {
    urlCheck?: boolean
  }
}

export function validateGeneratedProjectConfig(projectConfig: unknown): string[]