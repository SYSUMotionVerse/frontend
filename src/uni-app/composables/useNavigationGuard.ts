import { resolveStudentNextPage } from '../../domain/student/state'
import type { StudentAppState } from '../../domain/student/types'
import { studentBackendSync } from '../api/studentBackend'

let protectedAccessCheck: Promise<boolean> | null = null
let protectedAccessVerified = false

export function resolveNextPageFromSnapshot(snapshot: StudentAppState) {
  return resolveStudentNextPage(snapshot)
}

export async function ensureProtectedStudentAccess() {
  if (protectedAccessVerified) return true
  if (protectedAccessCheck) return protectedAccessCheck

  protectedAccessCheck = (async () => {
    try {
      const result = await studentBackendSync.bootstrapAccess()
      if (result.targetPage === 'home') {
        protectedAccessVerified = true
        return true
      }

      await uni.reLaunch({ url: result.targetPageUrl })
      return false
    } catch {
      await uni.reLaunch({ url: '/pages/access/startup' })
      return false
    } finally {
      protectedAccessCheck = null
    }
  })()

  return protectedAccessCheck
}

export function resetProtectedStudentAccessForTests() {
  protectedAccessVerified = false
  protectedAccessCheck = null
}
