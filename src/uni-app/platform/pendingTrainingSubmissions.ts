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
      videoId?: number
      score?: number
      comment?: string
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
  clear: () => void
}

const storageKey = 'sport-snack:pending-training-submissions'
const submissionTtlMs = 30 * 24 * 60 * 60 * 1000
// Capacity must cover at least 30 days at 3 sessions/day = 90 entries.
const maxPendingSubmissions = 90
// Reject queuedAt values more than 5 minutes in the future to prevent
// clock-skew/clock-manipulation bypass of the 30-day TTL.
const defaultMaxClockSkewMs = 5 * 60 * 1000
// qualityScore is clamped to [0, 100] by the sensor producer (computeQualityScore).
const minQualityScore = 0
const maxQualityScore = 100

interface PendingTrainingSubmissionStoreOptions {
  now?: () => Date
  maxClockSkewMs?: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPendingTrainingSubmission(value: unknown): value is PendingTrainingSubmission {
  if (!value || typeof value !== 'object') {
    return false
  }

  const submission = value as Partial<PendingTrainingSubmission>
  if (
    typeof submission.sessionId !== 'string' ||
    submission.sessionId.length === 0 ||
    typeof submission.queuedAt !== 'string' ||
    !Number.isFinite(Date.parse(submission.queuedAt)) ||
    !isFiniteNumber(submission.durationSeconds) ||
    submission.durationSeconds <= 0
  ) {
    return false
  }

  if (submission.kind === 'visual') {
    const hasValidVideoId = submission.videoId === undefined || (
      isFiniteNumber(submission.videoId) &&
      Number.isInteger(submission.videoId) &&
      submission.videoId > 0
    )
    const hasValidScore = submission.score === undefined || (
      isFiniteNumber(submission.score) &&
      submission.score >= minQualityScore &&
      submission.score <= maxQualityScore
    )
    const hasValidComment = submission.comment === undefined || typeof submission.comment === 'string'
    return hasValidVideoId && hasValidScore && hasValidComment && (
      submission.modality === 'wushu' || submission.modality === 'hiit'
    )
  }

  return submission.kind === 'stairs' &&
    isFiniteNumber(submission.completedIntervals) &&
    submission.completedIntervals >= 0 &&
    Number.isInteger(submission.completedIntervals) &&
    isFiniteNumber(submission.qualityScore) &&
    Number.isInteger(submission.qualityScore) &&
    submission.qualityScore >= minQualityScore &&
    submission.qualityScore <= maxQualityScore &&
    (typeof submission.summary === 'string' || Boolean(submission.summary && typeof submission.summary === 'object'))
}

function sanitizeSubmissions(
  value: unknown,
  now: Date = new Date(),
  maxClockSkewMs: number = defaultMaxClockSkewMs
) {
  if (!Array.isArray(value)) {
    return []
  }

  const nowMs = now.getTime()
  const oldestAllowedAt = nowMs - submissionTtlMs
  const newestAllowedAt = nowMs + maxClockSkewMs

  return value
    .filter(isPendingTrainingSubmission)
    .filter(submission => {
      const queuedAtMs = Date.parse(submission.queuedAt)
      return queuedAtMs >= oldestAllowedAt && queuedAtMs <= newestAllowedAt
    })
    .slice(-maxPendingSubmissions)
}

export function createPendingTrainingSubmissionStore(
  options: PendingTrainingSubmissionStoreOptions = {}
): PendingTrainingSubmissionStore {
  const now = options.now ?? (() => new Date())
  const maxClockSkewMs = options.maxClockSkewMs ?? defaultMaxClockSkewMs
  let memoryFallback: PendingTrainingSubmission[] = []

  function read() {
    if (typeof uni === 'undefined') {
      memoryFallback = sanitizeSubmissions(memoryFallback, now(), maxClockSkewMs)
      return memoryFallback
    }

    const stored = uni.getStorageSync(storageKey)
    const sanitized = sanitizeSubmissions(stored, now(), maxClockSkewMs)
    if (!Array.isArray(stored) || sanitized.length !== stored.length) {
      write(sanitized)
    }
    return sanitized
  }

  function write(submissions: PendingTrainingSubmission[]) {
    if (typeof uni === 'undefined') {
      memoryFallback = submissions
      return
    }

    uni.setStorageSync(storageKey, submissions)
  }

  function clear() {
    memoryFallback = []
    if (typeof uni === 'undefined') {
      return
    }

    if (typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(storageKey)
      return
    }
    uni.setStorageSync(storageKey, [])
  }

  return {
    list: () => [...read()],
    save(submission) {
      const remaining = read().filter(item => item.sessionId !== submission.sessionId)
      write(sanitizeSubmissions([...remaining, submission], now(), maxClockSkewMs))
    },
    remove(sessionId) {
      write(read().filter(item => item.sessionId !== sessionId))
    },
    clear
  }
}
