import { studentBackendSync } from '../api/studentBackend'
import type { VisualSessionSyncInput } from '../api/studentBackendTypes'
import { createTrainingSessionId } from '../platform/trainingSessionId'

type VisualTrainingSubmissionInput = Omit<VisualSessionSyncInput, 'sessionId'>

export function useVisualTrainingSubmission() {
  const sessionId = createTrainingSessionId('visual')
  let trainingCredential: string | undefined

  return {
    sessionId,
    async prepare(input: {
      modality: VisualSessionSyncInput['modality']
      videoId: number
      arrangementId?: number
    }) {
      const issued = await studentBackendSync.prepareVisualTrainingSession({
        sessionId,
        ...input
      })
      trainingCredential = issued?.credential
      return issued
    },
    sync(input: VisualTrainingSubmissionInput) {
      return studentBackendSync.syncVisualSession({
        sessionId,
        ...(trainingCredential ? { trainingCredential } : {}),
        ...input
      })
    }
  }
}
