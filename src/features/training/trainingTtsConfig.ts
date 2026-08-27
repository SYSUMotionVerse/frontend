import type { ActionTtsCue } from '../../domain/training/actionScoringTypes'
import type {
  ExerciseArrangementItem,
  TrainingCountdownTtsCue,
  TrainingTtsCue,
  TrainingTtsPhase
} from '../../uni-app/api/studentBackendTypes'

export interface TrainingTtsPhaseTiming {
  phaseDurationSeconds: number
  countdownDurationSeconds?: number
}

const embeddedCountdownPattern = /[3３]\s*[，,、]\s*[2２]\s*[，,、]\s*[1１]\s*[，,、]?\s*go[！!]?/i

function toNonNegativeSeconds(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0
}

function isUsableCue(cue: TrainingTtsCue) {
  return cue.text.trim().length > 0 && cue.audio_url.trim().length > 0
}

function resolveCueTime(cue: TrainingTtsCue, timing: TrainingTtsPhaseTiming) {
  const duration = toNonNegativeSeconds(timing.phaseDurationSeconds)
  const offset = toNonNegativeSeconds(cue.offset_seconds)

  switch (cue.timing) {
    case 'START':
      return 0
    case 'AFTER_OFFSET':
      return offset < duration ? offset : null
    case 'BEFORE_END':
      // A zero-offset "before end" cue should still have a chance to start;
      // an exact-at-end cue belongs to the explicit COMPLETE option instead.
      return duration > 0 ? Math.max(0, duration - Math.max(0.1, offset)) : null
    case 'BEFORE_COUNTDOWN': {
      const countdown = toNonNegativeSeconds(timing.countdownDurationSeconds)
      return countdown > 0 && countdown < duration ? duration - countdown : null
    }
    case 'COMPLETE':
      return null
    default:
      return null
  }
}

/** Convert published backend cues into the time-based player input for one module. */
export function resolveTrainingPhaseTtsCues(
  item: ExerciseArrangementItem | null | undefined,
  phase: TrainingTtsPhase,
  timing: TrainingTtsPhaseTiming
): ActionTtsCue[] {
  if (!item) return []

  return (item.training_tts_cues ?? [])
    .filter(cue => cue.phase === phase && isUsableCue(cue))
    .map(cue => ({ cue, time: resolveCueTime(cue, timing) }))
    .filter((entry): entry is { cue: TrainingTtsCue; time: number } => entry.time !== null)
    .sort((left, right) => (
      left.time - right.time
      || left.cue.order - right.cue.order
      || left.cue.id - right.cue.id
    ))
    .map(({ cue, time }) => ({
      time,
      text: cue.text,
      audio_url: cue.audio_url
    }))
}

/** COMPLETE cues are a deliberate hand-off signal, not a video-time cue. */
export function resolveTrainingPhaseCompletionAudioUrls(
  item: ExerciseArrangementItem | null | undefined,
  phase: TrainingTtsPhase
) {
  if (!item) return []
  return (item.training_tts_cues ?? [])
    .filter(cue => (
      cue.phase === phase
      && cue.timing === 'COMPLETE'
      && isUsableCue(cue)
    ))
    .slice()
    .sort((left, right) => left.order - right.order || left.id - right.id)
    .map(cue => cue.audio_url)
}

export function resolveTrainingPhaseStartAudioUrls(cues: readonly ActionTtsCue[]) {
  return cues
    .filter(cue => cue.time <= 0)
    .map(cue => cue.audio_url)
}

export function resolveTrainingPhaseDelayedTtsCues(cues: readonly ActionTtsCue[]) {
  return cues.filter(cue => cue.time > 0)
}

/**
 * Resolve a countdown that is already embedded at the end of the pretraining
 * guidance. These cues are the hand-off into formal training, so a second
 * formal-countdown module would only repeat the same 3/2/1/Go prompt.
 */
export function resolveEmbeddedPretrainingCountdownDuration(
  item: ExerciseArrangementItem | null | undefined,
  phaseDurationSeconds: number
) {
  const duration = toNonNegativeSeconds(phaseDurationSeconds)
  if (duration <= 0 || !item) return 0

  const cue = (item.training_tts_cues ?? [])
    .filter(entry => (
      entry.phase === 'PRETRAINING'
      && entry.timing === 'AFTER_OFFSET'
      && isUsableCue(entry)
      && embeddedCountdownPattern.test(entry.text)
    ))
    .sort((left, right) => right.offset_seconds - left.offset_seconds || right.order - left.order)[0]
  if (!cue) return 0

  const remaining = duration - toNonNegativeSeconds(cue.offset_seconds)
  return remaining > 0 && remaining <= 10 ? Math.round(remaining) : 0
}

export function resolveTrainingCountdownAudioUrls(
  cues: readonly TrainingCountdownTtsCue[] | null | undefined,
  countdownDurationSeconds: number
) {
  return resolveTrainingCountdownTtsCues(cues, countdownDurationSeconds)
    .map(cue => cue.audio_url)
}

/**
 * Place the global 3/2/1 speech at the matching point in a module countdown.
 * A five-second countdown, for example, stays silent for two seconds and
 * begins "3" only when three seconds are actually remaining.
 */
export function resolveTrainingCountdownTtsCues(
  cues: readonly TrainingCountdownTtsCue[] | null | undefined,
  countdownDurationSeconds: number
): ActionTtsCue[] {
  const duration = toNonNegativeSeconds(countdownDurationSeconds)
  return (cues ?? [])
    .filter(cue => (
      cue.seconds_remaining <= duration
      && cue.audio_url.trim().length > 0
    ))
    .slice()
    .sort((left, right) => right.seconds_remaining - left.seconds_remaining)
    .map(cue => ({
      time: duration - cue.seconds_remaining,
      text: cue.text,
      audio_url: cue.audio_url
    }))
}

/** All database-owned audio for preloading; action-standard audio is excluded. */
export function resolveArrangementTtsAudioUrls(items: readonly ExerciseArrangementItem[]) {
  return items.flatMap(item => (
    item.training_tts_cues
      ?.filter(isUsableCue)
      .map(cue => cue.audio_url)
      ?? []
  ))
}
