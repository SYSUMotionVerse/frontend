import type { StudentProfile } from '../../types/student'

export interface RegistrationProfileStorage {
  load: () => StudentProfile | null
  save: (profile: StudentProfile) => void
  clear: () => void
}

const storageKey = 'sport-snack:registration-profile'
// Short privacy TTL for locally cached registration fields.  The backend now
// persists age, grade, and resting_heart_rate on the User model, so these
// fields are authoritative on the backend and returned via /users/me/.  This
// local cache is only a fallback when the backend payload is unavailable or
// missing those fields (e.g. legacy accounts that have not yet re-registered).
// TTL expiry does NOT force a correctly registered backend user back to
// registration; the bootstrap flow reads backend fields first and falls back
// to this cache only when the backend omits them.
const profileTtlMs = 30 * 24 * 60 * 60 * 1000
// Reject savedAt values more than 5 minutes in the future to prevent
// clock-manipulation bypass of the TTL.
const maxSavedAtSkewMs = 5 * 60 * 1000

interface StoredProfileEnvelope {
  version: 1
  savedAt: number
  profile: StudentProfile
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStoredProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const profile = value as Partial<StudentProfile>
  return (
    typeof profile.studentId === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.gender === 'string' &&
    isFiniteNumber(profile.age) &&
    typeof profile.major === 'string' &&
    typeof profile.grade === 'string' &&
    isFiniteNumber(profile.heightCm) &&
    isFiniteNumber(profile.weightKg) &&
    isFiniteNumber(profile.restingHeartRate) &&
    typeof profile.completed === 'boolean'
  )
}

function isStoredProfileEnvelope(value: unknown): value is StoredProfileEnvelope {
  if (!value || typeof value !== 'object') {
    return false
  }

  const envelope = value as Partial<StoredProfileEnvelope>
  return envelope.version === 1 &&
    isFiniteNumber(envelope.savedAt) &&
    isStoredProfile(envelope.profile)
}

export function createRegistrationProfileStorage(): RegistrationProfileStorage {
  let memoryFallback: StoredProfileEnvelope | null = null

  function clear() {
    memoryFallback = null
    if (typeof uni === 'undefined') {
      return
    }

    if (typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(storageKey)
      return
    }
    uni.setStorageSync(storageKey, null)
  }

  function save(profile: StudentProfile) {
    const envelope: StoredProfileEnvelope = {
      version: 1,
      savedAt: Date.now(),
      profile: { ...profile }
    }

    if (typeof uni === 'undefined') {
      memoryFallback = envelope
      return
    }

    uni.setStorageSync(storageKey, envelope)
  }

  function loadEnvelope(value: unknown) {
    if (!isStoredProfileEnvelope(value)) {
      return null
    }
    const now = Date.now()
    if (value.savedAt > now + maxSavedAtSkewMs) {
      // Implausible or future savedAt — treat as invalid to prevent TTL bypass.
      return null
    }
    if (now - value.savedAt > profileTtlMs) {
      return null
    }
    return value
  }

  return {
    load() {
      if (typeof uni === 'undefined') {
        const envelope = loadEnvelope(memoryFallback)
        if (!envelope) {
          clear()
          return null
        }
        return { ...envelope.profile }
      }

      const stored = uni.getStorageSync(storageKey)
      const envelope = loadEnvelope(stored)
      if (envelope) {
        return { ...envelope.profile }
      }

      if (isStoredProfile(stored)) {
        save(stored)
        return { ...stored }
      }

      clear()
      return null
    },
    save,
    clear
  }
}
