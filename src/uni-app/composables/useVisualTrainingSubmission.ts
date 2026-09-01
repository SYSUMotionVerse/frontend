import { studentBackendSync } from '../api/studentBackend'
import type { VisualSessionSyncInput } from '../api/studentBackendTypes'
import { createTrainingSessionId } from '../platform/trainingSessionId'

type VisualTrainingSubmissionInput = Omit<VisualSessionSyncInput, 'sessionId'>

export function useVisualTrainingSubmission() {
  const sessionId = createTrainingSessionId('visual')
  let trainingCredential: string | undefined
  let submissionSnapshot: VisualTrainingSubmissionInput | undefined

  return {
    sessionId,
    async prepare(input: {
      modality: VisualSessionSyncInput['modality']
      videoId: number
      arrangementId?: number
      arrangementFingerprint?: string
    }) {
      const issued = await studentBackendSync.prepareVisualTrainingSession({
        sessionId,
        ...input
      })
      trainingCredential = issued?.credential
      return issued
    },
    sync(input: VisualTrainingSubmissionInput) {
      // A timed-out request may already have committed on the server. Keep
      // every retry byte-for-byte identical (especially completedAt) so the
      // backend can safely return the existing record for this session ID.
      submissionSnapshot ??= input
      return studentBackendSync.syncVisualSession({
        sessionId,
        ...(trainingCredential ? { trainingCredential } : {}),
        ...submissionSnapshot
      })
    }
  }
}
