import type {
  StairSessionSyncInput,
  VisualPoseAnalysisPayload
} from '../api/studentBackendTypes'
import type { TrainingModality } from '../../types/student'

export type PendingTrainingSubmission =
  | {
      kind: 'visual'
      sessionId: string
      modality: Exclude<TrainingModality, 'stair'>
      durationSeconds: number
      poseAnalysis?: VisualPoseAnalysisPayload
      queuedAt: string
    }
  | {
      kind: 'stairs'
      sessionId: string
      durationSeconds: number
      completedIntervals: number
      qualityScore: number
      summary: StairSessionSyncInput['summary']
      queuedAt: string
    }

export interface PendingTrainingSubmissionStore {
  list: () => PendingTrainingSubmission[]
  save: (submission: PendingTrainingSubmission) => void
  remove: (sessionId: string) => void
}

const storageKey = 'sport-snack:pending-training-submissions'

export function createPendingTrainingSubmissionStore(): PendingTrainingSubmissionStore {
  let memoryFallback: PendingTrainingSubmission[] = []

  function read() {
    if (typeof uni === 'undefined') {
      return memoryFallback
    }

    const stored = uni.getStorageSync(storageKey)
    return Array.isArray(stored) ? stored as PendingTrainingSubmission[] : []
  }

  function write(submissions: PendingTrainingSubmission[]) {
    if (typeof uni === 'undefined') {
      memoryFallback = submissions
      return
    }

    uni.setStorageSync(storageKey, submissions)
  }

  return {
    list: () => [...read()],
    save(submission) {
      const remaining = read().filter(item => item.sessionId !== submission.sessionId)
      write([...remaining, submission])
    },
    remove(sessionId) {
      write(read().filter(item => item.sessionId !== sessionId))
    }
  }
}
