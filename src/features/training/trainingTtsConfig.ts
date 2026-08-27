import type { ActionTtsCue } from '../../domain/training/actionScoringTypes'
import type {
  ExerciseArrangementItem,
  TrainingCountdownTtsCue,
  TrainingTtsCue,
  TrainingTtsPhase
} from '../../uni-app/api/studentBackendTypes'

export interface TrainingTtsPhaseTiming {
  phaseDurationSeconds: number
}

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
    case 'BEFORE_COUNTDOWN':
      // A module countdown is its own phase. Its configured prompt is
      // scheduled when that countdown starts, not inferred from the end of
      // the preceding video module.
      return null
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

/** Prompts configured for the explicit countdown phase before one module. */
export function resolveTrainingPhaseCountdownStartAudioUrls(
  item: ExerciseArrangementItem | null | undefined,
  phase: TrainingTtsPhase
) {
  if (!item) return []
  return (item.training_tts_cues ?? [])
    .filter(cue => (
      cue.phase === phase
      && cue.timing === 'BEFORE_COUNTDOWN'
      && isUsableCue(cue)
    ))
    .slice()
    .sort((left, right) => left.order - right.order || left.id - right.id)
    .map(cue => cue.audio_url)
}

/**
 * Resolve the audio that can run during a module's explicit countdown phase.
 * A module-owned prompt deliberately replaces the shared 3/2/1 sequence, so
 * playback and preload callers must both use this selection rule.
 */
export function resolveTrainingCountdownPhaseAudio(
  item: ExerciseArrangementItem | null | undefined,
  phase: TrainingTtsPhase,
  globalCountdownCues: readonly TrainingCountdownTtsCue[] | null | undefined
) {
  if (!item) {
    return {
      phaseStartAudioUrls: [],
      globalCues: [] as ActionTtsCue[]
    }
  }

  const phaseStartAudioUrls = resolveTrainingPhaseCountdownStartAudioUrls(item, phase)
  const duration = phase === 'PRETRAINING'
    ? item.pretraining_mode === 'NONE'
      ? 0
      : toNonNegativeSeconds(item.pretraining_countdown_duration)
    : toNonNegativeSeconds(item.formal_countdown_duration)

  return {
    phaseStartAudioUrls,
    globalCues: phaseStartAudioUrls.length > 0
      ? []
      : resolveTrainingCountdownTtsCues(globalCountdownCues, duration)
  }
}

export function resolveTrainingPhaseStartAudioUrls(cues: readonly ActionTtsCue[]) {
  return cues
    .filter(cue => cue.time <= 0)
    .map(cue => cue.audio_url)
}

export function resolveTrainingPhaseDelayedTtsCues(cues: readonly ActionTtsCue[]) {
  return cues.filter(cue => cue.time > 0)
}

export function resolveTrainingCountdownAudioUrls(
  cues: readonly TrainingCountdownTtsCue[] | null | undefined,
  countdownDurationSeconds: number
) {
  return resolveTrainingCountdownTtsCues(cues, countdownDurationSeconds)
    .map(cue => cue.audio_url)
}

/**
 * Global countdown prompts are shared by every action. Warm every prompt
 * that the published modules can reach, rather than assuming a fixed
 * three-second countdown.
 */
export function resolveArrangementCountdownTtsAudioUrls(
  items: readonly ExerciseArrangementItem[],
  cues: readonly TrainingCountdownTtsCue[] | null | undefined
) {
  const audioUrls = items.flatMap(item => [
    ...resolveTrainingCountdownPhaseAudio(item, 'PRETRAINING', cues).globalCues,
    ...resolveTrainingCountdownPhaseAudio(item, 'FORMAL', cues).globalCues
  ].map(cue => cue.audio_url))

  return [...new Set(audioUrls)]
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

function resolvePretrainingDurationForTts(item: ExerciseArrangementItem) {
  return Math.max(
    1,
    toNonNegativeSeconds(item.pretraining_duration)
      || toNonNegativeSeconds(item.video.duration)
      || toNonNegativeSeconds(item.expected_duration)
  )
}

function resolveRunnablePhaseAudioUrls(
  item: ExerciseArrangementItem,
  phase: TrainingTtsPhase,
  timing: TrainingTtsPhaseTiming
) {
  return [
    ...resolveTrainingPhaseTtsCues(item, phase, timing),
    ...resolveTrainingPhaseCountdownStartAudioUrls(item, phase).map(audio_url => ({ audio_url })),
    ...resolveTrainingPhaseCompletionAudioUrls(item, phase).map(audio_url => ({ audio_url }))
  ].map(cue => cue.audio_url)
}

/**
 * Database-owned audio that can actually be reached by the current module
 * configuration. Action-standard audio is deliberately excluded.
 */
export function resolveArrangementTtsAudioUrls(items: readonly ExerciseArrangementItem[]) {
  return items.flatMap(item => {
    const formalAudioUrls = resolveRunnablePhaseAudioUrls(item, 'FORMAL', {
      phaseDurationSeconds: Math.max(1, toNonNegativeSeconds(item.expected_duration))
    })

    if (item.pretraining_mode === 'NONE') return formalAudioUrls

    return [
      ...resolveRunnablePhaseAudioUrls(item, 'PRETRAINING', {
        phaseDurationSeconds: resolvePretrainingDurationForTts(item)
      }),
      ...formalAudioUrls
    ]
  })
}
