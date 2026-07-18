export type ShortQuestionnaireResponse = {
  energyLevel: number
  confidence: number
  enjoyment: number
}

export type PendingShortQuestionnaireSubmission = {
  sessionId: string
  response: ShortQuestionnaireResponse
  queuedAt: string
}

export interface PendingShortQuestionnaireStore {
  list: () => PendingShortQuestionnaireSubmission[]
  save: (submission: PendingShortQuestionnaireSubmission) => void
  remove: (sessionId: string) => void
}

const storageKey = 'sport-snack:pending-short-questionnaires'

export function createPendingShortQuestionnaireStore(): PendingShortQuestionnaireStore {
  let memoryFallback: PendingShortQuestionnaireSubmission[] = []

  function read() {
    if (typeof uni === 'undefined') {
      return memoryFallback
    }

    const stored = uni.getStorageSync(storageKey)
    return Array.isArray(stored) ? stored as PendingShortQuestionnaireSubmission[] : []
  }

  function write(submissions: PendingShortQuestionnaireSubmission[]) {
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
