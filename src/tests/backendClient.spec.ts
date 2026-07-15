import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBackendClient } from '../uni-app/api/backendClient'

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

  const uploadFile = vi.fn((options: UniApp.UploadFileOption) => {
    options.success?.({
      data: JSON.stringify({
        message: '头像上传成功',
        user: {
          avatar: '/media/avatars/avatar.png'
        }
      }),
      errMsg: 'uploadFile:ok',
      statusCode: 200
    })

    return {} as UniApp.UploadTask
  })

  return {
    login,
    request,
    uploadFile
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

  it('fetches current user from /users/me/ with session cookie after bootstrap', async () => {
    const currentUser = {
      id: 3,
      name: 'Lin',
      gender: 1,
      student_id: '20260003',
      major: '运动训练',
      height: '170.00',
      weight: '62.00',
      avatar: '/media/avatars/avatar.png'
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

    expect(user).toEqual({
      ...currentUser,
      avatar: 'http://api.example.com/media/avatars/avatar.png'
    })
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
    expect(uniMock.request.mock.calls[0]?.[0].url).toBe('http://api.example.com/exercises/records/score_trend/')
  })

  it('normalizes relative avatar urls without relying on the URL constructor in mini-program runtimes', async () => {
    const originalUrl = (globalThis as { URL?: unknown }).URL
    ;(globalThis as { URL?: unknown }).URL = undefined

    const currentUser = {
      id: 3,
      name: 'Lin',
      gender: 1,
      student_id: '20260003',
      major: '运动训练',
      height: '170.00',
      weight: '62.00',
      avatar: '/media/avatars/avatar.png'
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

    const client = createBackendClient('http://api.example.com/base/path')
    await client.ensureSession()
    const user = await client.getCurrentUser()

    expect(user).toEqual({
      ...currentUser,
      avatar: 'http://api.example.com/media/avatars/avatar.png'
    })

    ;(globalThis as { URL?: unknown }).URL = originalUrl
  })

  it('uploads avatar with session cookie and csrf token, then resolves an absolute avatar url', async () => {
    const uniMock = createUniMock([
      {
        statusCode: 200,
        data: {
          user: {
            id: 5
          }
        },
        cookies: [
          'csrftoken=test-csrf-token; Path=/; SameSite=Lax',
          'sessionid=test-session; Path=/; HttpOnly; SameSite=Lax'
        ]
      }
    ])

    ;(globalThis as { uni?: unknown }).uni = uniMock

    const client = createBackendClient('http://api.example.com')

    await client.ensureSession()
    const result = await client.uploadAvatar('wxfile://avatar.png')

    expect(uniMock.uploadFile).toHaveBeenCalledTimes(1)
    expect(uniMock.uploadFile.mock.calls[0]?.[0]).toMatchObject({
      url: 'http://api.example.com/users/upload_avatar/',
      filePath: 'wxfile://avatar.png',
      name: 'file',
      header: {
        Cookie: 'csrftoken=test-csrf-token; sessionid=test-session',
        'X-CSRFToken': 'test-csrf-token'
      }
    })
    expect(result).toEqual({
      avatarUrl: 'http://api.example.com/media/avatars/avatar.png'
    })
  })

  it('rejects avatar upload when the mini-program upload callback never returns', async () => {
    vi.useFakeTimers()

    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        statusCode: 200,
        data: {
          user: {
            id: 5
          }
        },
        cookies: [
          'csrftoken=test-csrf-token; Path=/; SameSite=Lax',
          'sessionid=test-session; Path=/; HttpOnly; SameSite=Lax'
        ]
      } as never)

      return {} as UniApp.RequestTask
    })

    const login = vi.fn((options: UniApp.LoginOptions) => {
      options.success?.({
        authResult: '',
        code: 'wechat-code',
        errMsg: 'login:ok'
      })
    })

    const uploadFile = vi.fn(() => ({} as UniApp.UploadTask))

    ;(globalThis as { uni?: unknown }).uni = {
      request,
      login,
      uploadFile
    }

    const client = createBackendClient('http://api.example.com')

    await client.ensureSession()

    const uploadPromise = client.uploadAvatar('wxfile://avatar.png')
    const rejectionExpectation = expect(uploadPromise).rejects.toThrow('Avatar upload timed out.')
    await vi.advanceTimersByTimeAsync(15001)

    await rejectionExpectation

    vi.useRealTimers()
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
})
