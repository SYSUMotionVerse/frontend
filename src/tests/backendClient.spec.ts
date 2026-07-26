import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BackendRequestError,
  createBackendClient
} from '../uni-app/api/backendClient'

interface MockRequestResponse {
  statusCode: number
  data: unknown
  header?: Record<string, unknown>
  cookies?: string[]
}

function createUniMock(responses: MockRequestResponse[]) {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    const response = responses.shift()

    if (!response) {
      throw new Error(`Unexpected request for ${options.url}`)
    }

    options.success?.(response as never)
    return {} as UniApp.RequestTask
  })

  const login = vi.fn((options: UniApp.LoginOptions) => {
    options.success?.({
      authResult: '',
      code: 'wechat-code',
      errMsg: 'login:ok'
    })
  })

  return {
    login,
    request
  }
}

describe('backend client session handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    delete (globalThis as { uni?: unknown }).uni
  })

  it('falls back to the local api base url when VITE_API_BASE_URL is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          count: 0,
          next: null,
          previous: null,
          results: []
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const { createBackendClient } = await import('../uni-app/api/backendClient')
    const client = createBackendClient()

    await client.listPsychologyScales()

    expect(uniMock.request).toHaveBeenCalledTimes(1)
    expect(uniMock.request.mock.calls[0]?.[0].url).toBe('http://127.0.0.1:8000/api/psychology/scales/')
  })

  it('reuses the session cookie exposed through response.cookies in mini-program requests', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          user: {
            id: 1
          }
        },
        cookies: [
          'csrftoken=test-csrf-token; Path=/; SameSite=Lax',
          'sessionid=test-session; Path=/; HttpOnly; SameSite=Lax'
        ]
      },
      {
        statusCode: 200,
        data: {
          message: '所有量表已完成'
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')

    await client.ensureSession()
    await client.getNextPsychologyScale()

    expect(uniMock.login).toHaveBeenCalledTimes(1)
    expect(uniMock.request).toHaveBeenCalledTimes(2)
    expect(uniMock.request.mock.calls[1]?.[0].header).toMatchObject({
      Cookie: 'csrftoken=test-csrf-token; sessionid=test-session'
    })
  })

  it('sends X-CSRFToken for unsafe requests after session bootstrap', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          user: {
            id: 1
          }
        },
        cookies: [
          'csrftoken=test-csrf-token; Path=/; SameSite=Lax',
          'sessionid=test-session; Path=/; HttpOnly; SameSite=Lax'
        ]
      },
      {
        statusCode: 200,
        data: {
          message: '提交成功',
          record: {}
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')

    await client.ensureSession()
    await client.submitPsychologyScale({
      scale_id: 1,
      answers: []
    })

    expect(uniMock.request.mock.calls[1]?.[0].header).toMatchObject({
      Cookie: 'csrftoken=test-csrf-token; sessionid=test-session',
      'X-CSRFToken': 'test-csrf-token'
    })
  })

  it('rejects an invalid VITE_SHORT_QUESTIONNAIRE_ENDPOINT at client construction', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', 'https://api.example.com/short-questionnaires')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must be a same-backend relative path'
    )
  })

  it('rejects a query string in VITE_SHORT_QUESTIONNAIRE_ENDPOINT', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/exercises/short-questionnaires?foo=bar')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must be a same-backend relative path'
    )
  })

  it('rejects path traversal in VITE_SHORT_QUESTIONNAIRE_ENDPOINT', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/exercises/../admin/short-questionnaires')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must be a same-backend relative path'
    )
  })

  it('rejects an empty path ("/") in VITE_SHORT_QUESTIONNAIRE_ENDPOINT', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not be an empty path'
    )
  })

  it('rejects whitespace in VITE_SHORT_QUESTIONNAIRE_ENDPOINT', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/exercises /short-questionnaires')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not contain whitespace or control characters'
    )
  })

  it('rejects percent-encoded path traversal in VITE_SHORT_QUESTIONNAIRE_ENDPOINT', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/exercises/%2e%2e/admin')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash'
    )
  })

  it('rejects percent-encoded backslash in VITE_SHORT_QUESTIONNAIRE_ENDPOINT', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/exercises%5cadmin')
    ;(globalThis as { uni?: unknown }).uni = createUniMock([])

    const { createBackendClient } = await import('../uni-app/api/backendClient')

    expect(() => createBackendClient('http://api.example.com')).toThrow(
      'VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash'
    )
  })

  it('exposes the short questionnaire POST only through an explicit endpoint contract', async () => {
    vi.stubEnv('VITE_SHORT_QUESTIONNAIRE_ENDPOINT', '/exercises/short-questionnaires')
    const uniMock = createUniMock([{
      statusCode: 201,
      data: {
        id: 9,
        user: 1,
        training_session_id: 'session-9',
        energy_level: 4,
        confidence: 5,
        enjoyment: 3,
        created_at: '2026-07-19T10:00:00Z',
        updated_at: '2026-07-19T10:00:00Z'
      }
    }])
    ;(globalThis as { uni?: unknown }).uni = uniMock
    const client = createBackendClient('http://api.example.com')

    await client.submitShortQuestionnaire?.({
      training_session_id: 'session-9',
      energy_level: 4,
      confidence: 5,
      enjoyment: 3
    })

    expect(uniMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://api.example.com/exercises/short-questionnaires/',
      method: 'POST',
      data: {
        training_session_id: 'session-9',
        energy_level: 4,
        confidence: 5,
        enjoyment: 3
      }
    }))
  })

  it('synchronizes reminder authorization through the authenticated reminder endpoint', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: { user: { id: 1 } },
        cookies: [
          'csrftoken=test-csrf-token; Path=/; SameSite=Lax',
          'sessionid=test-session; Path=/; HttpOnly; SameSite=Lax'
        ]
      },
      {
        statusCode: 200,
        data: { status: 'rejected', updated_at: '2026-07-16T12:00:00Z' }
      }
    ])
    ;(globalThis as { uni?: unknown }).uni = uniMock
    const client = createBackendClient('http://api.example.com')

    await client.ensureSession()
    const result = await client.updateReminderAuthorization('rejected')

    expect(result.status).toBe('rejected')
    expect(uniMock.request.mock.calls[1]?.[0]).toMatchObject({
      url: 'http://api.example.com/notifications/reminders/authorization/',
      method: 'PATCH',
      data: { status: 'rejected' },
      header: expect.objectContaining({
        Cookie: 'csrftoken=test-csrf-token; sessionid=test-session',
        'X-CSRFToken': 'test-csrf-token'
      })
    })
  })

  it('loads reminder template configuration from the authenticated backend', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          status: 'not_requested',
          updated_at: null,
          template_id: 'server-template-id',
          mode: 'test'
        }
      }
    ])
    ;(globalThis as { uni?: unknown }).uni = uniMock
    const client = createBackendClient('http://api.example.com')

    const result = await client.getReminderAuthorization()

    expect(result).toMatchObject({
      template_id: 'server-template-id',
      mode: 'test'
    })
    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/notifications/reminders/authorization/'
    )
  })

  it('loads arrangement summaries and then its item detail', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          count: 1,
          results: [{
            id: 7,
            title: '武术基本功入门',
            exercise_type: 'MARTIAL_ARTS',
            item_count: 2,
            total_duration: 60,
            is_active: true,
            order: 1
          }]
        }
      },
      {
        statusCode: 200,
        data: {
          id: 7,
          title: '武术基本功入门',
          exercise_type: 'MARTIAL_ARTS',
          item_count: 1,
          total_duration: 30,
          is_active: true,
          order: 1,
          items: []
        }
      }
    ])
    ;(globalThis as { uni?: unknown }).uni = uniMock
    const client = createBackendClient('http://api.example.com')

    const summaries = await client.listExerciseArrangements('MARTIAL_ARTS')
    const detail = await client.getExerciseArrangement(7)

    expect(summaries[0]?.id).toBe(7)
    expect(detail.id).toBe(7)
    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/exercises/arrangements/?exercise_type=MARTIAL_ARTS'
    )
    expect(uniMock.request.mock.calls[1]?.[0].url).toBe(
      'http://api.example.com/exercises/arrangements/7/'
    )
  })

  it('fetches current user from /users/me/ with session cookie after bootstrap', async () => {
    const currentUser = {
      id: 3,
      name: 'Lin',
      gender: 1,
      student_id: '20260003',
      major: '运动训练',
      height: '170.00',
      weight: '62.00'
    }

    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          user: {
            id: 3
          }
        },
        cookies: [
          'csrftoken=test-csrf-token; Path=/; SameSite=Lax',
          'sessionid=test-session; Path=/; HttpOnly; SameSite=Lax'
        ]
      },
      {
        statusCode: 200,
        data: currentUser
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')

    await client.ensureSession()
    const user = await client.getCurrentUser()

    expect(user).toEqual(currentUser)
    expect(uniMock.request.mock.calls[1]?.[0].url).toBe('http://api.example.com/users/me/')
    expect(uniMock.request.mock.calls[1]?.[0].header).toMatchObject({
      Cookie: 'csrftoken=test-csrf-token; sessionid=test-session'
    })
  })

  it('loads visual score trend from the exercise records trend endpoint', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          trend: [
            { recordId: 11, date: '2026-04-10', overallScore: 82.5 },
            { recordId: 12, date: '2026-04-11', overallScore: 91 }
          ],
          dimensions: [
            { key: 'stability', label: '稳定性', values: [84, 90] }
          ],
          summary: {
            sessionCount: 2,
            latestOverallScore: 91,
            bestOverallScore: 91
          }
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    const trend = await client.getExerciseScoreTrend()

    expect(trend).toEqual({
      trend: [
        { recordId: 11, date: '2026-04-10', overallScore: 82.5 },
        { recordId: 12, date: '2026-04-11', overallScore: 91 }
      ],
      dimensions: [
        { key: 'stability', label: '稳定性', values: [84, 90] }
      ],
      summary: {
        sessionCount: 2,
        latestOverallScore: 91,
        bestOverallScore: 91
      }
    })
    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/exercises/records/score_trend/?days=all'
    )
  })

  it('requests complete exercise and stairs history explicitly', async () => {
    const uniMock = createUniMock([
      { statusCode: 200, data: [] },
      { statusCode: 200, data: [] }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    await client.listExerciseRecords()
    await client.listStairRecords()

    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/exercises/records/my_records/?days=all'
    )
    expect(uniMock.request.mock.calls[1]?.[0].url).toBe(
      'http://api.example.com/exercises/stairs/my_records/?days=all'
    )
  })

  it('unwraps paginated psychology scale lists into arrays', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 1,
              title: '运动心理健康量表（第1次）',
              description: '评估运动对心理健康的影响',
              order: 1,
              created_at: '2026-04-11 10:00:00',
              questions: []
            }
          ]
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    const scales = await client.listPsychologyScales()
    const firstScale = scales[0]

    expect(scales).toHaveLength(1)
    expect(firstScale).toBeDefined()
    expect(firstScale?.id).toBe(1)
  })

  it('unwraps paginated psychology records into arrays for startup gating', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 9,
              total_score: 12,
              analysis: '保持规律运动。',
              completed_at: '2026-04-11 10:00:00',
              scale_info: {
                id: 1,
                title: '运动心理健康量表（第1次）',
                description: '评估运动对心理健康的影响',
                order: 1,
                created_at: '2026-04-11 09:00:00',
                questions: []
              }
            }
          ]
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    const records = await client.listPsychologyRecords()
    const firstRecord = records[0]

    expect(records).toHaveLength(1)
    expect(firstRecord).toBeDefined()
    expect(firstRecord?.id).toBe(9)
  })

  it('requests only the supported weekly compliance trend contract', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          type: 'weekly',
          trend: []
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    await client.getComplianceTrend(8)

    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/exercises/compliance/trend/?type=weekly&weeks=8'
    )
  })

  it('requests the selected monthly compliance calendar', async () => {
    const uniMock = createUniMock([{
      statusCode: 200,
      data: {
        year: 2026,
        month: 7,
        days: [],
        completed_days: 0,
        total_training_count: 0
      }
    }])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    await client.getComplianceCalendar(2026, 7)

    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/exercises/compliance/calendar/?year=2026&month=7'
    )
  })

  it('loads every notification page returned by the backend', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          count: 2,
          next: 'http://api.example.com/notifications/messages/?notification_type=TRAINING_REMINDER&page=2',
          results: [{ id: 1 }]
        }
      },
      {
        statusCode: 200,
        data: {
          count: 2,
          next: null,
          results: [{ id: 2 }]
        }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock
    const client = createBackendClient('http://api.example.com')

    await expect(client.listNotifications()).resolves.toEqual([{ id: 1 }, { id: 2 }])
    expect(uniMock.request).toHaveBeenCalledTimes(2)
  })

  it('loads persisted achievement awards from training progress', async () => {
    const payload = {
      milestones: [],
      session_badges: []
    }
    const uniMock = createUniMock([{ statusCode: 200, data: payload }])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')

    await expect(client.getAchievementAwards()).resolves.toEqual(payload)
    expect(uniMock.request.mock.calls[0]?.[0].url).toBe(
      'http://api.example.com/exercises/progress/achievements/'
    )
    expect(uniMock.request.mock.calls[0]?.[0].method).toBe('POST')
  })

  it('exposes the response status code on backend request errors', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 410,
        data: { detail: 'Reminder return has expired.' }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    const request = client.resolveReminderReturn({
      tracking_id: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '12:00',
      local_date: '2026-07-16'
    })

    await expect(request).rejects.toEqual(
      expect.objectContaining<Partial<BackendRequestError>>({
        message: 'Reminder return has expired.',
        statusCode: 410
      })
    )
  })

  it('re-authenticates once and retries an authenticated request after a 401', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: { user: { id: 1 } },
        cookies: ['sessionid=expired-session; Path=/; HttpOnly']
      },
      {
        statusCode: 401,
        data: { detail: 'Authentication credentials were not provided.' }
      },
      {
        statusCode: 200,
        data: { user: { id: 1 } },
        cookies: ['sessionid=fresh-session; Path=/; HttpOnly']
      },
      {
        statusCode: 200,
        data: { message: '所有量表已完成' }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    await client.ensureSession()
    const result = await client.getNextPsychologyScale()

    expect(result).toEqual({ message: '所有量表已完成' })
    expect(uniMock.login).toHaveBeenCalledTimes(2)
    expect(uniMock.request).toHaveBeenCalledTimes(4)
    expect(uniMock.request.mock.calls[3]?.[0].header).toMatchObject({
      Cookie: 'sessionid=fresh-session'
    })
  })

  it('sets an explicit timeout on backend requests', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: { message: '所有量表已完成' }
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')
    await client.getNextPsychologyScale()

    expect(uniMock.request.mock.calls[0]?.[0].timeout).toBe(15000)
  })
})
