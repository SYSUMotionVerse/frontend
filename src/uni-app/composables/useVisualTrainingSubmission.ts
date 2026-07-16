import { studentBackendSync } from '../api/studentBackend'
import type { VisualSessionSyncInput } from '../api/studentBackendTypes'
import { createTrainingSessionId } from '../platform/trainingSessionId'

type VisualTrainingSubmissionInput = Omit<VisualSessionSyncInput, 'sessionId'>

export function useVisualTrainingSubmission() {
  const sessionId = createTrainingSessionId('visual')

  return {
    sessionId,
    sync(input: VisualTrainingSubmissionInput) {
      return studentBackendSync.syncVisualSession({
        sessionId,
        ...input
      })
    }
  }
}
