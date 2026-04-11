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
      height: 172,
      weight: 62
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
})
