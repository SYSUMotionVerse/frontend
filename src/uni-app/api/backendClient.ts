import type {
  AvatarUploadResult,
  BackendCurrentUser,
  BackendExerciseRecord,
  BackendExerciseScoreTrendResponse,
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
  UserUpdatePayload,
  BackendComplianceSummary,
  BackendComplianceCalendar,
  BackendComplianceTrend,
  BackendTrainingProgress,
  BackendStationNotification,
  BackendUnreadNotifications,
  BackendReminderReturn,
  BackendReminderReturnPayload,
} from './studentBackendTypes'
import type {
  ReminderAuthorizationConfig,
  ReminderAuthorizationStatus
} from '../platform/reminderConsent'

type BackendReminderAuthorization = ReminderAuthorizationConfig & {
  status: ReminderAuthorizationStatus
  updated_at: string | null
}

type RequestMethod = NonNullable<UniApp.RequestOptions['method']> | 'PATCH'

interface RequestOptions {
  method?: RequestMethod
  data?: unknown
  headers?: Record<string, string>
  hasRetriedAuthentication?: boolean
}

interface PaginatedResponse<T> {
  count?: number
  next?: string | null
  previous?: string | null
  results: T[]
}

export class BackendRequestError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'BackendRequestError'
    this.statusCode = statusCode
  }
}

const methodsRequiringCsrf = new Set<RequestMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])
const defaultApiBaseUrl = 'http://127.0.0.1:8000/api'
const avatarUploadTimeoutMs = 15000
const requestTimeoutMs = 15000

function normalizeBaseUrl(input: string) {
  return input.replace(/\/+$/, '')
}

function resolveBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  return normalizeBaseUrl(configuredBaseUrl || defaultApiBaseUrl)
}

function resolveSetCookie(header: unknown) {
  if (!header || typeof header !== 'object') {
    return []
  }

  const record = header as Record<string, unknown>
  const nextCookie = record['Set-Cookie'] ?? record['set-cookie']

  if (Array.isArray(nextCookie)) {
    return nextCookie.filter(item => typeof item === 'string')
  }

  return typeof nextCookie === 'string' ? [nextCookie] : []
}

function resolveResponseCookies(response: {
  header?: unknown
  cookies?: unknown
}) {
  if (Array.isArray(response.cookies)) {
    const cookies = response.cookies.filter(item => typeof item === 'string')
    if (cookies.length > 0) {
      return cookies
    }
  }

  return resolveSetCookie(response.header)
}

function resolveCookiePair(cookie: string) {
  const pair = cookie.split(';', 1)[0]?.trim() ?? ''
  if (!pair.includes('=')) {
    return null
  }

  const separatorIndex = pair.indexOf('=')
  const name = pair.slice(0, separatorIndex).trim()
  const value = pair.slice(separatorIndex + 1).trim()

  if (!name || !value) {
    return null
  }

  return [name, value] as const
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

function unwrapCollectionResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Partial<PaginatedResponse<T>>
  return Array.isArray(record.results) ? record.results : []
}

function resolveBaseOrigin(baseUrl: string) {
  const matched = baseUrl.match(/^(https?:\/\/[^/]+)/i)
  return matched?.[1] ?? ''
}

function resolveAbsoluteUrl(value: string | null | undefined, baseUrl: string) {
  if (typeof value !== 'string') {
    return value ?? null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//.test(trimmed)) {
    return trimmed
  }

  if (!trimmed.startsWith('/')) {
    return trimmed
  }

  const origin = resolveBaseOrigin(baseUrl)
  return origin ? `${origin}${trimmed}` : trimmed
}

function normalizeCurrentUser(user: BackendCurrentUser, baseUrl: string): BackendCurrentUser {
  return {
    ...user,
    avatar: resolveAbsoluteUrl(user.avatar, baseUrl)
  }
}

function resolveUploadedAvatarUrl(payload: unknown, baseUrl: string) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as {
    avatarUrl?: unknown
    data?: unknown
    user?: {
      avatar?: unknown
    }
  }

  if (typeof record.avatarUrl === 'string' && record.avatarUrl.trim().length > 0) {
    return resolveAbsoluteUrl(record.avatarUrl, baseUrl) ?? ''
  }

  if (record.data && typeof record.data === 'object') {
    const nestedAvatarUrl = (record.data as { avatarUrl?: unknown }).avatarUrl
    if (typeof nestedAvatarUrl === 'string' && nestedAvatarUrl.trim().length > 0) {
      return resolveAbsoluteUrl(nestedAvatarUrl, baseUrl) ?? ''
    }
  }

  const userAvatar = record.user?.avatar
  if (typeof userAvatar === 'string' && userAvatar.trim().length > 0) {
    return resolveAbsoluteUrl(userAvatar, baseUrl) ?? ''
  }

  return ''
}

function parseUploadResponse(data: unknown) {
  if (typeof data !== 'string') {
    return data
  }

  try {
    return JSON.parse(data) as unknown
  } catch {
    return data
  }
}

export function createBackendClient(baseUrl = resolveBaseUrl()) {
  let sessionCookie = ''
  let hasAuthenticatedSession = false
  const cookieJar = new Map<string, string>()

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

    const method = (options.method ?? 'GET') as RequestMethod
    const csrfToken = cookieJar.get('csrftoken')

    try {
      return await new Promise<T>((resolve, reject) => {
      uni.request({
        url: `${baseUrl}${path}`,
        method: method as UniApp.RequestOptions['method'],
        data: options.data ?? {},
        timeout: requestTimeoutMs,
        header: {
          'content-type': 'application/json',
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          ...(csrfToken && methodsRequiringCsrf.has(method)
            ? { 'X-CSRFToken': csrfToken }
            : {}),
          ...options.headers
        },
        success(response) {
          const nextCookies = resolveResponseCookies(response as {
            header?: unknown
            cookies?: unknown
          })

          nextCookies.forEach(cookie => {
            const pair = resolveCookiePair(cookie)
            if (!pair) {
              return
            }

            cookieJar.set(pair[0], pair[1])
          })

          if (cookieJar.size > 0) {
            sessionCookie = Array.from(cookieJar.entries())
              .map(([name, value]) => `${name}=${value}`)
              .join('; ')
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data as T)
            return
          }

          reject(new BackendRequestError(
            resolveErrorMessage(response.data, `Request failed with ${response.statusCode}`),
            response.statusCode
          ))
        },
        fail(error) {
          reject(error)
        }
      })
      })
    } catch (error) {
      const shouldRetryAuthentication =
        error instanceof BackendRequestError &&
        (error.statusCode === 401 || error.statusCode === 403) &&
        hasAuthenticatedSession &&
        !options.hasRetriedAuthentication &&
        path !== '/users/wechat_login/'

      if (!shouldRetryAuthentication) {
        throw error
      }

      resetSession()
      await ensureSession()
      return request<T>(path, {
        ...options,
        hasRetriedAuthentication: true
      })
    }
  }

  function resetSession() {
    hasAuthenticatedSession = false
    sessionCookie = ''
    cookieJar.clear()
  }

  async function ensureSession() {
    if (!isEnabled() || hasAuthenticatedSession) {
      return
    }

    const code = await login()
    await request('/users/wechat_login/', {
      method: 'POST',
      data: { code }
    })
    hasAuthenticatedSession = true
  }

  async function uploadAvatar(filePath: string): Promise<AvatarUploadResult> {
    await ensureSession()

    if (typeof uni === 'undefined') {
      throw new Error('Avatar upload is not available in this environment.')
    }

    const csrfToken = cookieJar.get('csrftoken')

    return new Promise<AvatarUploadResult>((resolve, reject) => {
      let settled = false
      const timeoutId = setTimeout(() => {
        if (settled) {
          return
        }

        settled = true
        reject(new Error('Avatar upload timed out.'))
      }, avatarUploadTimeoutMs)

      function settleWith(
        action: 'resolve' | 'reject',
        payload: AvatarUploadResult | Error
      ) {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeoutId)

        if (action === 'resolve') {
          resolve(payload as AvatarUploadResult)
          return
        }

        reject(payload as Error)
      }

      uni.uploadFile({
        url: `${baseUrl}/users/upload_avatar/`,
        filePath,
        name: 'file',
        header: {
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {})
        },
        success(result) {
          if ((result.statusCode ?? 0) < 200 || (result.statusCode ?? 0) >= 300) {
            settleWith('reject', new Error(`Avatar upload failed with ${result.statusCode}`))
            return
          }

          const avatarUrl = resolveUploadedAvatarUrl(parseUploadResponse(result.data), baseUrl)
          if (!avatarUrl) {
            settleWith('reject', new Error('Avatar upload response did not include avatar url.'))
            return
          }

          settleWith('resolve', { avatarUrl })
        },
        fail(error) {
          settleWith(
            'reject',
            error instanceof Error ? error : new Error(resolveErrorMessage(error, 'Avatar upload failed.'))
          )
        }
      })
    })
  }

  return {
    isEnabled,
    ensureSession,
    getCurrentUser() {
      return request<BackendCurrentUser>('/users/me/').then(user =>
        normalizeCurrentUser(user, baseUrl)
      )
    },
    uploadAvatar,
    updateProfile(payload: UserUpdatePayload) {
      return request('/users/update_profile/', {
        method: 'PATCH',
        data: payload
      })
    },
    getReminderAuthorization() {
      return request<BackendReminderAuthorization>(
        '/notifications/reminders/authorization/'
      )
    },
    updateReminderAuthorization(status: ReminderAuthorizationStatus) {
      return request<BackendReminderAuthorization>(
        '/notifications/reminders/authorization/',
        {
          method: 'PATCH',
          data: { status }
        }
      )
    },
    createSurveyRecord(payload: SurveyRecordCreatePayload) {
      return request('/users/survey-records/', {
        method: 'POST',
        data: payload
      })
    },
    listExerciseVideos(exerciseType: BackendExerciseType) {
      return request<ExerciseVideoSummary[] | PaginatedResponse<ExerciseVideoSummary>>(
        `/exercises/videos/?exercise_type=${exerciseType}`
      ).then(response => unwrapCollectionResponse<ExerciseVideoSummary>(response))
    },
    createExerciseRecord(payload: ExerciseRecordCreatePayload) {
      return request<BackendExerciseRecord>('/exercises/records/', {
        method: 'POST',
        data: payload
      })
    },
    getExerciseScoreTrend() {
      return request<BackendExerciseScoreTrendResponse>('/exercises/records/score_trend/')
    },
    createStairsRecord(payload: StairsRecordCreatePayload) {
      return request('/exercises/stairs/', {
        method: 'POST',
        data: payload
      })
    },
    listPsychologyScales() {
      return request<BackendPsychologyScale[] | PaginatedResponse<BackendPsychologyScale>>(
        '/psychology/scales/'
      ).then(response => unwrapCollectionResponse<BackendPsychologyScale>(response))
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
      return request<BackendPsychologyRecord[] | PaginatedResponse<BackendPsychologyRecord>>(
        '/psychology/records/my_records/'
      ).then(response => unwrapCollectionResponse<BackendPsychologyRecord>(response))
    },
    listExerciseRecords() {
      return request<BackendExerciseRecord[] | PaginatedResponse<BackendExerciseRecord>>(
        '/exercises/records/my_records/'
      ).then(response => unwrapCollectionResponse<BackendExerciseRecord>(response))
    },
    listStairRecords() {
      return request<BackendStairRecord[] | PaginatedResponse<BackendStairRecord>>(
        '/exercises/stairs/my_records/'
      ).then(response => unwrapCollectionResponse<BackendStairRecord>(response))
    },
    getPhysicalTestTrend() {
      return request<BackendPhysicalTrendResponse>('/physical-tests/trend/')
    },
    getMyCompliance() {
      return request<BackendComplianceSummary>('/exercises/compliance/my_compliance/')
    },
    getComplianceCalendar(year: number, month: number) {
      return request<BackendComplianceCalendar>(
        `/exercises/compliance/calendar/?year=${year}&month=${month}`
      )
    },
    getComplianceTrend(count = 12) {
      return request<BackendComplianceTrend>(
        `/exercises/compliance/trend/?type=weekly&weeks=${count}`
      )
    },
    getTrainingProgress() {
      return request<BackendTrainingProgress>('/exercises/progress/today/')
    },
    listNotifications() {
      return request<BackendStationNotification[] | PaginatedResponse<BackendStationNotification>>(
        '/notifications/messages/?notification_type=TRAINING_REMINDER'
      ).then(response => unwrapCollectionResponse<BackendStationNotification>(response))
    },
    getUnreadNotifications() {
      return request<BackendUnreadNotifications>(
        '/notifications/messages/unread/?notification_type=TRAINING_REMINDER'
      )
    },
    markNotificationRead(id: number) {
      return request(`/notifications/messages/${id}/mark_read/`, {
        method: 'POST'
      })
    },
    resolveReminderReturn(payload: BackendReminderReturnPayload) {
      return request<BackendReminderReturn>('/notifications/messages/resolve_return/', {
        method: 'POST',
        data: payload
      })
    }
  }
}
