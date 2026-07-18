import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialStudentState } from '../domain/student/state'

describe('registration profile storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('survives a store recreation through mini-program storage', async () => {
    let stored: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      })
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const profile = {
      ...createInitialStudentState().profile,
      studentId: '20260001',
      name: 'Lin',
      age: 16,
      grade: '高二',
      restingHeartRate: 66,
      completed: true
    }

    createRegistrationProfileStorage().save(profile)

    expect(createRegistrationProfileStorage().load()).toEqual(profile)
  })
})
