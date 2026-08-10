import { readonly, shallowRef } from 'vue'
import { resolveStudentNextPage } from '../../domain/student/state'
import type { StudentAppState } from '../../domain/student/types'
import {
  studentBackendSync,
  type BootstrapAccessResult
} from '../api/studentBackend'

export type ProtectedAccessMode = 'browse' | 'execute'

const accessState = shallowRef<{
  level: 'unknown' | 'browse' | 'execute'
  questionnaireUrl: string
}>({
  level: 'unknown',
  questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline'
})

let protectedAccessCheck: Promise<BootstrapAccessResult> | null = null

export function resolveNextPageFromSnapshot(snapshot: StudentAppState) {
  return resolveStudentNextPage(snapshot)
}

function updateAccessState(result: BootstrapAccessResult) {
  if (result.targetPage === 'home') {
    accessState.value = {
      level: 'execute',
      questionnaireUrl: accessState.value.questionnaireUrl
    }
    return
  }

  if (result.targetPage === 'questionnaire') {
    accessState.value = {
      level: 'browse',
      questionnaireUrl: result.targetPageUrl
    }
  }
}

async function resolveProtectedAccess() {
  if (protectedAccessCheck) return protectedAccessCheck

  protectedAccessCheck = studentBackendSync.bootstrapAccess()
  try {
    const result = await protectedAccessCheck
    updateAccessState(result)
    return result
  } finally {
    protectedAccessCheck = null
  }
}

export async function ensureProtectedStudentAccess(
  mode: ProtectedAccessMode = 'execute'
) {
  if (accessState.value.level === 'execute') return true
  if (mode === 'browse' && accessState.value.level === 'browse') return true

  try {
    const result = await resolveProtectedAccess()
    if (result.targetPage === 'home') return true
    if (mode === 'browse' && result.targetPage === 'questionnaire') return true

    await uni.reLaunch({ url: result.targetPageUrl })
    return false
  } catch {
    await uni.reLaunch({ url: '/pages/access/startup' })
    return false
  }
}

export function useProtectedAccessState() {
  return readonly(accessState)
}

export function continueRequiredQuestionnaire() {
  void uni.reLaunch({
    url: accessState.value.questionnaireUrl
  })
}

export function resetProtectedStudentAccessForTests() {
  protectedAccessCheck = null
  accessState.value = {
    level: 'unknown',
    questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline'
  }
}
