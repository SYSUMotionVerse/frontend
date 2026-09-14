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
  questionnaireCheckpoint?: BootstrapAccessResult['questionnaireCheckpoint']
  questionnaireAvailable?: boolean
  questionnaireScheduledAt?: string | null
}>({
  level: 'unknown',
  questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline'
})

let protectedAccessCheck: Promise<BootstrapAccessResult> | null = null

export function resolveNextPageFromSnapshot(snapshot: StudentAppState) {
  return resolveStudentNextPage(snapshot)
}

function updateAccessState(result: BootstrapAccessResult) {
  const questionnaireCheckpoint = result.questionnaireCheckpoint ?? result.checkpoint
  const questionnaireUrl = questionnaireCheckpoint
    ? `/pages/access/questionnaire?checkpoint=${questionnaireCheckpoint}`
    : accessState.value.questionnaireUrl
  const questionnaireMetadata = questionnaireCheckpoint
    ? {
        questionnaireCheckpoint,
        questionnaireAvailable: result.questionnaireAvailable ?? true,
        ...(result.questionnaireScheduledAt !== undefined
          ? { questionnaireScheduledAt: result.questionnaireScheduledAt }
          : {})
      }
    : {}

  if (result.targetPage === 'home') {
    accessState.value = {
      level: 'execute',
      questionnaireUrl,
      ...questionnaireMetadata
    }
    return
  }

  if (result.targetPage === 'questionnaire') {
    accessState.value = {
      level: 'browse',
      questionnaireUrl: result.targetPageUrl,
      ...questionnaireMetadata
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

/**
 * Refresh the authoritative access/checkpoint snapshot without redirecting.
 * The training home uses this as a rate-limited foreground refresh so a daily
 * window or follow-up checkpoint that opens while the app is warm becomes
 * discoverable without turning a follow-up into an execution gate.
 */
export async function refreshProtectedStudentAccess() {
  try {
    return await resolveProtectedAccess()
  } catch {
    return null
  }
}

export function useProtectedAccessState() {
  return readonly(accessState)
}

export function continueRequiredQuestionnaire() {
  if (accessState.value.questionnaireAvailable === false) return
  void uni.reLaunch({
    url: accessState.value.questionnaireUrl
  })
}

export function markProtectedStudentAccessComplete() {
  accessState.value = {
    level: 'execute',
    questionnaireUrl: accessState.value.questionnaireUrl,
    ...(accessState.value.questionnaireCheckpoint
      ? { questionnaireCheckpoint: accessState.value.questionnaireCheckpoint }
      : {}),
    ...(accessState.value.questionnaireAvailable !== undefined
      ? { questionnaireAvailable: accessState.value.questionnaireAvailable }
      : {}),
    ...(accessState.value.questionnaireScheduledAt !== undefined
      ? { questionnaireScheduledAt: accessState.value.questionnaireScheduledAt }
      : {})
  }
}

export function resetProtectedStudentAccessForTests() {
  protectedAccessCheck = null
  accessState.value = {
    level: 'unknown',
    questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline'
  }
}
