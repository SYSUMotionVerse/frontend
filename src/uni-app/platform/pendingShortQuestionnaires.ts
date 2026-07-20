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
  clear: () => void
}

const storageKey = 'sport-snack:pending-short-questionnaires'
const defaultRetentionMs = 90 * 24 * 60 * 60 * 1000
const defaultMaxEntries = 200
// Allow a small clock-skew margin so entries queued moments before "now"
// on a device with a slightly behind clock are not prematurely expired.
const defaultMaxClockSkewMs = 60 * 1000

interface PendingShortQuestionnaireStoreOptions {
  now?: () => Date
  retentionMs?: number
  maxEntries?: number
  maxClockSkewMs?: number
}

function isShortQuestionnaireResponseValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

function isPendingSubmission(value: unknown): value is PendingShortQuestionnaireSubmission {
  if (!value || typeof value !== 'object') {
    return false
  }

  const submission = value as Partial<PendingShortQuestionnaireSubmission>
  const response = submission.response
  return (
    typeof submission.sessionId === 'string' &&
    submission.sessionId.length > 0 &&
    typeof submission.queuedAt === 'string' &&
    Number.isFinite(Date.parse(submission.queuedAt)) &&
    Boolean(response) &&
    isShortQuestionnaireResponseValue(response?.energyLevel) &&
    isShortQuestionnaireResponseValue(response?.confidence) &&
    isShortQuestionnaireResponseValue(response?.enjoyment)
  )
}

export function createPendingShortQuestionnaireStore(
  options: PendingShortQuestionnaireStoreOptions = {}
): PendingShortQuestionnaireStore {
  const now = options.now ?? (() => new Date())
  const retentionMs = options.retentionMs ?? defaultRetentionMs
  const maxEntries = options.maxEntries ?? defaultMaxEntries
  const maxClockSkewMs = options.maxClockSkewMs ?? defaultMaxClockSkewMs
  let memoryFallback: PendingShortQuestionnaireSubmission[] = []

  function readRaw(): { entries: unknown[]; corrupt: boolean } {
    if (typeof uni === 'undefined') {
      return { entries: memoryFallback, corrupt: false }
    }

    const stored = uni.getStorageSync(storageKey)
    if (Array.isArray(stored)) {
      return { entries: stored, corrupt: false }
    }
    // A non-array root value is corrupt and must be replaced/cleared.
    return { entries: [], corrupt: true }
  }

  function prune(submissions: unknown[]) {
    const nowMs = now().getTime()
    const oldestAllowedAt = nowMs - retentionMs
    const newestAllowedAt = nowMs + maxClockSkewMs
    return submissions
      .filter(isPendingSubmission)
      .filter(submission => {
        const queuedAtMs = Date.parse(submission.queuedAt)
        return queuedAtMs >= oldestAllowedAt && queuedAtMs <= newestAllowedAt
      })
      .slice(-maxEntries)
  }

  function write(submissions: PendingShortQuestionnaireSubmission[]) {
    if (typeof uni === 'undefined') {
      memoryFallback = submissions
      return
    }

    uni.setStorageSync(storageKey, submissions)
  }

  return {
    list() {
      const { entries: stored, corrupt } = readRaw()
      const retained = prune(stored)
      if (corrupt || retained.length !== stored.length) {
        write(retained)
      }
      return [...retained]
    },
    save(submission) {
      const { entries: raw } = readRaw()
      const remaining = raw.filter(item => item !== null && typeof item === 'object' && (item as { sessionId?: string }).sessionId !== submission.sessionId)
      write(prune([...remaining, submission]))
    },
    remove(sessionId) {
      const { entries: raw } = readRaw()
      write(prune(raw.filter(item => item !== null && typeof item === 'object' && (item as { sessionId?: string }).sessionId !== sessionId)))
    },
    clear() {
      write([])
    }
  }
}
