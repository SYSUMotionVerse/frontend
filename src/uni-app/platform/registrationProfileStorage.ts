import type { StudentProfile } from '../../types/student'

export interface RegistrationProfileStorage {
  load: () => StudentProfile | null
  save: (profile: StudentProfile) => void
}

const storageKey = 'sport-snack:registration-profile'

function isStoredProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const profile = value as Partial<StudentProfile>
  return (
    typeof profile.age === 'number' &&
    typeof profile.grade === 'string' &&
    typeof profile.restingHeartRate === 'number'
  )
}

export function createRegistrationProfileStorage(): RegistrationProfileStorage {
  let memoryFallback: StudentProfile | null = null

  return {
    load() {
      if (typeof uni === 'undefined') {
        return memoryFallback ? { ...memoryFallback } : null
      }

      const stored = uni.getStorageSync(storageKey)
      return isStoredProfile(stored) ? { ...stored } : null
    },
    save(profile) {
      if (typeof uni === 'undefined') {
        memoryFallback = { ...profile }
        return
      }

      uni.setStorageSync(storageKey, { ...profile })
    }
  }
}
