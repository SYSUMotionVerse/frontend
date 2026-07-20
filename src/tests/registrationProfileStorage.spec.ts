import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialStudentState } from '../domain/student/state'
import type { StudentProfile } from '../types/student'

function createSeedProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    ...createInitialStudentState().profile,
    ...overrides
  }
}

describe('registration profile storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
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
    const profile = createSeedProfile({
      studentId: '20260001',
      name: 'Lin',
      age: 16,
      grade: '高二',
      restingHeartRate: 66,
      completed: true
    })

    createRegistrationProfileStorage().save(profile)

    expect(createRegistrationProfileStorage().load()).toEqual(profile)
  })

  it('stores a versioned envelope with savedAt timestamp', async () => {
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
    const profile = createSeedProfile({
      studentId: '20260002',
      name: 'Wei',
      age: 15,
      grade: '高一',
      restingHeartRate: 70,
      completed: true
    })

    createRegistrationProfileStorage().save(profile)

    expect(stored).toMatchObject({
      version: 1,
      savedAt: expect.any(Number),
      profile
    })
  })

  it('migrates a legacy raw profile into a versioned envelope', async () => {
    const legacyProfile = createSeedProfile({
      studentId: '20260003',
      name: 'Legacy',
      age: 17,
      grade: '高三',
      restingHeartRate: 64,
      completed: true
    })
    let stored: unknown = legacyProfile
    const setSpy = vi.fn((_key: string, value: unknown) => {
      stored = value
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: setSpy
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const loaded = createRegistrationProfileStorage().load()

    expect(loaded).toEqual(legacyProfile)
    // The legacy profile should be re-saved as a versioned envelope
    expect(setSpy).toHaveBeenCalledWith(
      'sport-snack:registration-profile',
      expect.objectContaining({
        version: 1,
        savedAt: expect.any(Number),
        profile: legacyProfile
      })
    )
  })

  it('expires and clears an envelope older than the TTL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const profile = createSeedProfile({
      studentId: '20260004',
      name: 'Expired',
      age: 16,
      grade: '高二',
      restingHeartRate: 68,
      completed: true
    })

    let stored: unknown = null
    const removeSpy = vi.fn()
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      }),
      removeStorageSync: removeSpy
    })

    createRegistrationProfileStorage().save(profile)

    // Advance past the 30-day TTL
    vi.setSystemTime(new Date('2026-02-15T00:00:00.000Z'))

    const loaded = createRegistrationProfileStorage().load()

    expect(loaded).toBeNull()
    // The expired envelope should be physically cleared
    expect(removeSpy).toHaveBeenCalledWith('sport-snack:registration-profile')
  })

  it('returns null and clears for a corrupt non-envelope value', async () => {
    let stored: unknown = 'corrupt-string'
    const removeSpy = vi.fn((_key: string) => {
      stored = null
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      }),
      removeStorageSync: removeSpy
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const loaded = createRegistrationProfileStorage().load()

    expect(loaded).toBeNull()
    expect(removeSpy).toHaveBeenCalledWith('sport-snack:registration-profile')
  })

  it('returns null and clears for a null storage value', async () => {
    let stored: unknown = null
    const removeSpy = vi.fn((_key: string) => {
      stored = null
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      }),
      removeStorageSync: removeSpy
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const loaded = createRegistrationProfileStorage().load()

    expect(loaded).toBeNull()
    expect(removeSpy).toHaveBeenCalledWith('sport-snack:registration-profile')
  })

  it('clear() physically removes the storage key', async () => {
    let stored: unknown = null
    const removeSpy = vi.fn((_key: string) => {
      stored = null
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      }),
      removeStorageSync: removeSpy
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const storage = createRegistrationProfileStorage()
    const profile = createSeedProfile({
      studentId: '20260005',
      name: 'Clear',
      age: 16,
      grade: '高二',
      restingHeartRate: 68,
      completed: true
    })
    storage.save(profile)
    expect(stored).not.toBeNull()

    storage.clear()

    expect(removeSpy).toHaveBeenCalledWith('sport-snack:registration-profile')
    expect(stored).toBeNull()
  })

  it('falls back to setStorageSync(null) when removeStorageSync is unavailable', async () => {
    let stored: unknown = null
    const setSpy = vi.fn((_key: string, value: unknown) => {
      stored = value
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: setSpy
      // removeStorageSync intentionally omitted
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const storage = createRegistrationProfileStorage()
    const profile = createSeedProfile({
      studentId: '20260006',
      name: 'Fallback',
      age: 16,
      grade: '高二',
      restingHeartRate: 68,
      completed: true
    })
    storage.save(profile)

    storage.clear()

    expect(setSpy).toHaveBeenCalledWith('sport-snack:registration-profile', null)
    expect(stored).toBeNull()
  })

  it('rejects an implausible future savedAt value', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))

    const futureProfile = createSeedProfile({
      studentId: '20260007',
      name: 'Future',
      age: 16,
      grade: '高二',
      restingHeartRate: 68,
      completed: true
    })
    // Envelope with savedAt 1 hour in the future
    const stored = {
      version: 1,
      savedAt: new Date('2026-07-18T13:00:00.000Z').getTime(),
      profile: futureProfile
    }
    const removeSpy = vi.fn((_key: string) => {})
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn(),
      removeStorageSync: removeSpy
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const loaded = createRegistrationProfileStorage().load()

    expect(loaded).toBeNull()
    expect(removeSpy).toHaveBeenCalledWith('sport-snack:registration-profile')
  })

  it('accepts a savedAt within the clock skew allowance', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))

    const profile = createSeedProfile({
      studentId: '20260008',
      name: 'Skew',
      age: 16,
      grade: '高二',
      restingHeartRate: 68,
      completed: true
    })
    // Envelope with savedAt 2 minutes in the future (within 5 min skew)
    const stored = {
      version: 1,
      savedAt: new Date('2026-07-18T12:02:00.000Z').getTime(),
      profile
    }
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn()
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const loaded = createRegistrationProfileStorage().load()

    expect(loaded).toEqual(profile)
  })
})

// TTL behaviour: local storage is a fallback/cache for study-specific fields.
// The backend now persists age, grade, and resting_heart_rate on the User model
// and returns them via /users/me/.  TTL expiry of this local cache does NOT
// force a correctly registered backend user back to registration; the bootstrap
// flow reads backend fields first and falls back to this cache only when the
// backend omits them.
describe('registration profile TTL interaction with bootstrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns null after TTL expiry so bootstrap falls back to local seed profile', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const profile = createSeedProfile({
      studentId: '20260010',
      name: 'TTL',
      age: 16,
      grade: '高二',
      restingHeartRate: 68,
      completed: true
    })
    let stored: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      }),
      removeStorageSync: vi.fn(() => {
        stored = null
      })
    })

    const { createRegistrationProfileStorage } = await import(
      '../uni-app/platform/registrationProfileStorage'
    )
    const storage = createRegistrationProfileStorage()
    storage.save(profile)

    // Advance 31 days past the TTL
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))

    expect(storage.load()).toBeNull()
    // After expiry, the storage key is physically removed
    expect(stored).toBeNull()
  })
})
