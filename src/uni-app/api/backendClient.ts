import type {
  BackendCurrentUser,
  BackendExerciseRecord,
  BackendExerciseScoreTrendResponse,
  BackendExerciseType,
  BackendPhysicalTrendResponse,
  BackendQuestionnairePlan,
  BackendPsychologyRecord,
  BackendPsychologyScale,
  PsychologyScaleSubmitPayload,
  PsychologyScaleSubmitResponse,
  BackendStairRecord,
  ExerciseRecordCreatePayload,
  ExerciseVideoSummary,
  ExerciseArrangementDetail,
  TutorialResponse,
  ExerciseArrangementSummary,
  StairsRecordCreatePayload,
  SurveyRecordCreatePayload,
  UserUpdatePayload,
  BackendComplianceSummary,
  BackendComplianceCalendar,
  BackendComplianceTrend,
  BackendTrainingProgress,
  BackendAchievementAwards,
  BackendStationNotification,
  BackendUnreadNotifications,
  BackendReminderReturn,
  BackendReminderReturnPayload,
  BackendShortQuestionnaireRecord,
  ShortQuestionnaireCreatePayload,
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
const requestTimeoutMs = 15000
const loginTimeoutMs = requestTimeoutMs

function normalizeBaseUrl(input: string) {
  return input.replace(/\/+$/, '')
}

function resolveBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  return normalizeBaseUrl(configuredBaseUrl || defaultApiBaseUrl)
}

function resolveShortQuestionnaireEndpoint() {
  const endpoint = import.meta.env.VITE_SHORT_QUESTIONNAIRE_ENDPOINT?.trim() ?? ''
  if (!endpoint) {
    return ''
  }

  if (
    !endpoint.startsWith('/') ||
    endpoint.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(endpoint) ||
    endpoint.includes('://') ||
    endpoint.includes('?') ||
    endpoint.includes('#') ||
    endpoint.includes('\\') ||
    endpoint.includes('..')
  ) {
    throw new Error(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must be a same-backend relative path beginning with one slash, ' +
      'with no scheme, host, query, fragment, traversal, or backslash.'
    )
  }

  // Reject empty path (just '/' or slashes only)
  const pathContent = endpoint.replace(/^\/+|\/+$/g, '')
  if (!pathContent) {
    throw new Error(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not be an empty path ("/").'
    )
  }

  // Reject whitespace or control characters
  if (/[\s\x00-\x1f\x7f]/.test(endpoint)) {
    throw new Error(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not contain whitespace or control characters.'
    )
  }

  // Reject percent-encoded traversal/backslash variants that could bypass checks
  if (/%2e|%2f|%5c/i.test(endpoint)) {
    throw new Error(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash.'
    )
  }

  return `/${pathContent}/`
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

export function createBackendClient(baseUrl = resolveBaseUrl()) {
  const shortQuestionnaireEndpoint = resolveShortQuestionnaireEndpoint()
  let sessionCookie = ''
  let hasAuthenticatedSession = false
  let sessionBootstrapPromise: Promise<void> | null = null
  const cookieJar = new Map<string, string>()

  function isEnabled() {
    return baseUrl.length > 0
  }

  async function login() {
    if (typeof uni === 'undefined') {
      throw new Error('WeChat login is not available in this environment.')
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        settle(() => reject(new Error('WeChat login timed out.')))
      }, loginTimeoutMs)

      function settle(action: () => void) {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timeout)
        action()
      }

      try {
        uni.login({
          success(result) {
            if (!result.code) {
              settle(() => reject(new Error('WeChat login did not return a code.')))
              return
            }

            settle(() => resolve(result.code))
          },
          fail(error) {
            settle(() => reject(error))
          }
        })
      } catch (error) {
        settle(() => reject(error))
      }
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
        let settled = false
        let requestTask: UniApp.RequestTask | undefined
        const timeout = setTimeout(() => {
          settle(() => reject(new Error('Backend request timed out.')))
          requestTask?.abort?.()
        }, requestTimeoutMs)

        function settle(action: () => void) {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timeout)
          action()
        }

        try {
          requestTask = uni.request({
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
              if (settled) {
                return
              }

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
                settle(() => resolve(response.data as T))
                return
              }

              settle(() => reject(new BackendRequestError(
                resolveErrorMessage(response.data, `Request failed with ${response.statusCode}`),
                response.statusCode
              )))
            },
            fail(error) {
              settle(() => reject(error))
            }
          })
        } catch (error) {
          settle(() => reject(error))
        }
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

  async function requestAllPages<T>(initialPath: string) {
    const items: T[] = []
    let nextPath: string | null = initialPath
    let pageCount = 0

    while (nextPath && pageCount < 100) {
      const response: T[] | PaginatedResponse<T> = await request<
        T[] | PaginatedResponse<T>
      >(nextPath)
      if (Array.isArray(response)) {
        items.push(...response)
        break
      }

      items.push(...unwrapCollectionResponse<T>(response))
      const next: string | null | undefined = response.next
      if (!next) break
      if (next.startsWith(baseUrl)) {
        nextPath = next.slice(baseUrl.length) || '/'
      } else if (next.startsWith('/') && !next.startsWith('//')) {
        nextPath = next
      } else {
        throw new Error('Backend pagination returned an unsafe next-page URL.')
      }
      pageCount += 1
    }

    if (pageCount >= 100) {
      throw new Error('Backend pagination exceeded the safety limit.')
    }
    return items
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

    if (sessionBootstrapPromise) {
      return sessionBootstrapPromise
    }

    const bootstrap = (async () => {
      const code = await login()
      await request('/users/wechat_login/', {
        method: 'POST',
        data: { code }
      })
      hasAuthenticatedSession = true
    })()
    sessionBootstrapPromise = bootstrap

    try {
      await bootstrap
    } finally {
      if (sessionBootstrapPromise === bootstrap) {
        sessionBootstrapPromise = null
      }
    }
  }

  return {
    isEnabled,
    ensureSession,
    getCurrentUser() {
      return request<BackendCurrentUser>('/users/me/')
    },
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
    ...(shortQuestionnaireEndpoint
      ? {
          submitShortQuestionnaire(payload: ShortQuestionnaireCreatePayload) {
            return request<BackendShortQuestionnaireRecord>(shortQuestionnaireEndpoint, {
              method: 'POST',
              data: payload
            })
          }
        }
      : {}),
    listExerciseVideos(exerciseType: BackendExerciseType) {
      return request<ExerciseVideoSummary[] | PaginatedResponse<ExerciseVideoSummary>>(
        `/exercises/videos/?exercise_type=${exerciseType}`
      ).then(response => unwrapCollectionResponse<ExerciseVideoSummary>(response))
    },
    listExerciseArrangements(exerciseType: BackendExerciseType) {
      return request<ExerciseArrangementSummary[] | PaginatedResponse<ExerciseArrangementSummary>>(
        `/exercises/arrangements/?exercise_type=${exerciseType}`
      ).then(response => unwrapCollectionResponse<ExerciseArrangementSummary>(response))
    },
    getExerciseArrangement(id: number) {
      return request<ExerciseArrangementDetail>(`/exercises/arrangements/${id}/`)
    },
    /** 获取动作讲解数据（含用户历史训练记录） */
    getExerciseVideoTutorial(videoId: number) {
      return request<TutorialResponse>(`/exercises/videos/${videoId}/tutorial/`)
    },
    createExerciseRecord(payload: ExerciseRecordCreatePayload) {
      return request<BackendExerciseRecord>('/exercises/records/', {
        method: 'POST',
        data: payload
      })
    },
    getExerciseScoreTrend() {
      return request<BackendExerciseScoreTrendResponse>(
        '/exercises/records/score_trend/?days=all'
      )
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
    getPsychologyQuestionnairePlan(checkpoint: BackendQuestionnairePlan['checkpoint']) {
      return request<BackendQuestionnairePlan>(
        `/psychology/scales/questionnaire-plan/?checkpoint=${encodeURIComponent(checkpoint)}`
      )
    },
    submitPsychologyScale(payload: PsychologyScaleSubmitPayload) {
      return request<PsychologyScaleSubmitResponse>(
        '/psychology/records/submit/?response_format=summary',
        {
          method: 'POST',
          data: payload
        }
      )
    },
    listPsychologyRecords() {
      return request<BackendPsychologyRecord[] | PaginatedResponse<BackendPsychologyRecord>>(
        '/psychology/records/my_records/?response_format=summary'
      ).then(response => unwrapCollectionResponse<BackendPsychologyRecord>(response))
    },
    listExerciseRecords() {
      return request<BackendExerciseRecord[] | PaginatedResponse<BackendExerciseRecord>>(
        '/exercises/records/my_records/?days=all'
      ).then(response => unwrapCollectionResponse<BackendExerciseRecord>(response))
    },
    listStairRecords() {
      return request<BackendStairRecord[] | PaginatedResponse<BackendStairRecord>>(
        '/exercises/stairs/my_records/?days=all'
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
    getAchievementAwards() {
      return request<BackendAchievementAwards>(
        '/exercises/progress/achievements/',
        { method: 'POST' }
      )
    },
    listNotifications() {
      return requestAllPages<BackendStationNotification>(
        '/notifications/messages/?notification_type=TRAINING_REMINDER'
      )
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
