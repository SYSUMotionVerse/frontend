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

  return {
    login,
    request
  }
}

describe('backend client session handling', () => {
  afterEach(() => {
    delete (globalThis as { uni?: unknown }).uni
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

  it('fetches current user from /users/users/me/ with session cookie after bootstrap', async () => {
    const currentUser = {
      id: 3,
      name: 'Lin',
      gender: 1,
      student_id: '20260003',
      major: '运动训练',
      height: '172.00',
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
    expect(uniMock.request.mock.calls[1]?.[0].url).toBe('http://api.example.com/users/users/me/')
    expect(uniMock.request.mock.calls[1]?.[0].header).toMatchObject({
      Cookie: 'csrftoken=test-csrf-token; sessionid=test-session'
    })
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
})
