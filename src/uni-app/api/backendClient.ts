import type {
  BackendExerciseRecord,
  BackendExerciseType,
  BackendPhysicalTrendResponse,
  BackendPsychologyRecord,
  BackendPsychologyScale,
  PsychologyScaleSubmitPayload,
  PsychologyScaleSubmitResponse,
  BackendStairRecord,
  ExerciseRecordCreatePayload,
  ExerciseVideoSummary,
  StairsRecordCreatePayload,
  SurveyRecordCreatePayload,
  UserUpdatePayload
} from './studentBackendTypes'

type RequestMethod = NonNullable<UniApp.RequestOptions['method']> | 'PATCH'

interface RequestOptions {
  method?: RequestMethod
  data?: unknown
  headers?: Record<string, string>
}

function normalizeBaseUrl(input: string) {
  return input.replace(/\/+$/, '')
}

function resolveBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  return configuredBaseUrl ? normalizeBaseUrl(configuredBaseUrl) : ''
}

function resolveSetCookie(header: unknown) {
  if (!header || typeof header !== 'object') {
    return ''
  }

  const record = header as Record<string, unknown>
  const nextCookie = record['Set-Cookie'] ?? record['set-cookie']

  if (Array.isArray(nextCookie)) {
    return nextCookie.filter(item => typeof item === 'string').join('; ')
  }

  return typeof nextCookie === 'string' ? nextCookie : ''
}

function resolveErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const record = payload as Record<string, unknown>

  for (const key of ['detail', 'error', 'message']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return fallback
}

export function createBackendClient(baseUrl = resolveBaseUrl()) {
  let sessionCookie = ''
  let hasAuthenticatedSession = false

  function isEnabled() {
    return baseUrl.length > 0
  }

  async function login() {
    if (typeof uni === 'undefined') {
      throw new Error('WeChat login is not available in this environment.')
    }

    return new Promise<string>((resolve, reject) => {
      uni.login({
        success(result) {
          if (!result.code) {
            reject(new Error('WeChat login did not return a code.'))
            return
          }

          resolve(result.code)
        },
        fail(error) {
          reject(error)
        }
      })
    })
  }

  async function request<T>(path: string, options: RequestOptions = {}) {
    if (!isEnabled()) {
      throw new Error('Backend integration is disabled.')
    }

    if (typeof uni === 'undefined') {
      throw new Error('Network requests are not available in this environment.')
    }

    return new Promise<T>((resolve, reject) => {
      uni.request({
        url: `${baseUrl}${path}`,
        method: (options.method ?? 'GET') as UniApp.RequestOptions['method'],
        data: options.data ?? {},
        header: {
          'content-type': 'application/json',
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          ...options.headers
        },
        success(response) {
          const nextCookie = resolveSetCookie(response.header)
          if (nextCookie) {
            sessionCookie = nextCookie
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data as T)
            return
          }

          reject(new Error(resolveErrorMessage(response.data, `Request failed with ${response.statusCode}`)))
        },
        fail(error) {
          reject(error)
        }
      })
    })
  }

  async function ensureSession() {
    if (!isEnabled() || hasAuthenticatedSession) {
      return
    }

    const code = await login()
    await request('/users/users/wechat_login/', {
      method: 'POST',
      data: { code }
    })
    hasAuthenticatedSession = true
  }

  return {
    isEnabled,
    ensureSession,
    updateProfile(payload: UserUpdatePayload) {
      return request('/users/users/update_profile/', {
        method: 'PATCH',
        data: payload
      })
    },
    createSurveyRecord(payload: SurveyRecordCreatePayload) {
      return request('/users/survey-records/', {
        method: 'POST',
        data: payload
      })
    },
    listExerciseVideos(exerciseType: BackendExerciseType) {
      return request<ExerciseVideoSummary[]>(`/exercises/videos/?exercise_type=${exerciseType}`)
    },
    createExerciseRecord(payload: ExerciseRecordCreatePayload) {
      return request('/exercises/records/', {
        method: 'POST',
        data: payload
      })
    },
    createStairsRecord(payload: StairsRecordCreatePayload) {
      return request('/exercises/stairs/', {
        method: 'POST',
        data: payload
      })
    },
    listPsychologyScales() {
      return request<BackendPsychologyScale[]>('/psychology/scales/')
    },
    getNextPsychologyScale() {
      return request<BackendPsychologyScale | { message: string }>('/psychology/scales/next_scale/')
    },
    submitPsychologyScale(payload: PsychologyScaleSubmitPayload) {
      return request<PsychologyScaleSubmitResponse>('/psychology/records/submit/', {
        method: 'POST',
        data: payload
      })
    },
    listPsychologyRecords() {
      return request<BackendPsychologyRecord[]>('/psychology/records/my_records/')
    },
    listExerciseRecords() {
      return request<BackendExerciseRecord[]>('/exercises/records/my_records/')
    },
    listStairRecords() {
      return request<BackendStairRecord[]>('/exercises/stairs/my_records/')
    },
    getPhysicalTestTrend() {
      return request<BackendPhysicalTrendResponse>('/physical-tests/trend/')
    }
  }
}
