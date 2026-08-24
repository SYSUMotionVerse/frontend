import type { ExerciseArrangementItem } from '../../uni-app/api/studentBackendTypes'

export type VisualTrainingPlaybackState = 'idle' | 'playing' | 'paused' | 'ended'

/**
 * `preview` is the pre-start screen. The standalone action tutorial remains
 * outside this timeline. The actual follow-along session is backend-driven:
 * optional pretraining → mandatory formal training → optional rest.
 */
export type VisualWorkoutPhaseKind =
  | 'preview'
  | 'active'
  | 'rest'
  | 'demonstration'
  | 'countdown'

/** Distinguishes repeated countdowns without making UI code infer their role. */
export type VisualWorkoutPhaseSlot =
  | 'preview'
  | 'pretraining-countdown'
  | 'pretraining'
  | 'formal-countdown'
  | 'formal-training'
  | 'rest'

export const initialPreviewDurationSeconds = 15
export const initialStartCountdownSeconds = 3

export interface VisualWorkoutPhase {
  id: string
  kind: VisualWorkoutPhaseKind
  slot: VisualWorkoutPhaseSlot
  itemIndex: number
  actionNumber: number
  totalActions: number
  title: string
  coachCue: string
  startSeconds: number
  endSeconds: number
  /** Countdown displayed within this phase (used by the rest window). */
  countdownDuration?: number
}

export interface VisualWorkoutState {
  current: VisualWorkoutPhase
  next: VisualWorkoutPhase | null
  phaseNumber: number
  totalPhases: number
  actionNumber: number
  totalActions: number
  remainingSeconds: number
  phaseProgressPercent: number
  sessionProgressPercent: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeDuration(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0
}

export function resolveCountdownDuration(value: number | null | undefined) {
  return normalizeDuration(value)
}

export function resolvePretrainingMode(value: ExerciseArrangementItem['pretraining_mode']) {
  return value === 'NONE' ? 'NONE' : 'FULL'
}

function resolvePretrainingDuration(item: ExerciseArrangementItem) {
  return Math.max(
    1,
    normalizeDuration(item.video.duration) || normalizeDuration(item.expected_duration)
  )
}

export function buildVisualWorkoutTimeline(items: ExerciseArrangementItem[]): VisualWorkoutPhase[] {
  const orderedItems = [...items].sort((left, right) => left.order - right.order)
  const phases: VisualWorkoutPhase[] = []
  let cursor = 0

  function appendPhase(
    item: ExerciseArrangementItem,
    itemIndex: number,
    kind: VisualWorkoutPhaseKind,
    slot: VisualWorkoutPhaseSlot,
    duration: number,
    title: string,
    coachCue: string,
    countdownDuration = 0
  ) {
    const normalizedDuration = normalizeDuration(duration)
    if (normalizedDuration <= 0) return

    phases.push({
      id: `${item.id}-${slot}-${phases.length}`,
      kind,
      slot,
      itemIndex,
      actionNumber: itemIndex + 1,
      totalActions: orderedItems.length,
      title,
      coachCue,
      startSeconds: cursor,
      endSeconds: cursor + normalizedDuration,
      countdownDuration: Math.min(
        normalizedDuration,
        resolveCountdownDuration(countdownDuration)
      )
    })
    cursor += normalizedDuration
  }

  orderedItems.forEach((item, itemIndex) => {
    const actionTitle = item.video.title
    const pretrainingMode = resolvePretrainingMode(item.pretraining_mode)
    const pretrainingCountdownDuration = resolveCountdownDuration(
      item.pretraining_countdown_duration
    )
    if (pretrainingMode === 'FULL' && pretrainingCountdownDuration > 0) {
      appendPhase(
        item,
        itemIndex,
        'countdown',
        'pretraining-countdown',
        pretrainingCountdownDuration,
        `预训练倒计时：${actionTitle}`,
        '倒计时结束后播放完整预训练示范',
        pretrainingCountdownDuration
      )
    }

    if (pretrainingMode === 'FULL') {
      appendPhase(
        item,
        itemIndex,
        'demonstration',
        'pretraining',
        resolvePretrainingDuration(item),
        `预训练示范：${actionTitle}`,
        '先完整观看动作示范，随后进入正式训练倒计时'
      )
    }

    const formalCountdownDuration = resolveCountdownDuration(item.formal_countdown_duration)
    if (formalCountdownDuration > 0) {
      appendPhase(
        item,
        itemIndex,
        'countdown',
        'formal-countdown',
        formalCountdownDuration,
        `正式训练倒计时：${actionTitle}`,
        '倒计时结束后开始正式训练',
        formalCountdownDuration
      )
    }

    appendPhase(
      item,
      itemIndex,
      'active',
      'formal-training',
      Math.max(1, normalizeDuration(item.expected_duration)),
      `正式训练：${actionTitle}`,
      item.video.description?.trim() || '跟随示范，优先保证动作完整'
    )

    const nextItem = orderedItems[itemIndex + 1]
    const restDuration = normalizeDuration(item.rest_duration)
    if (nextItem && restDuration > 0) {
      appendPhase(
        nextItem,
        itemIndex + 1,
        'rest',
        'rest',
        restDuration,
        `休息，准备：${nextItem.video.title}`,
        '休息结束后按后台配置进入下一动作模块',
        item.rest_countdown_duration
      )
    }
  })

  return phases
}

export function resolveVisualWorkoutState(
  timeline: VisualWorkoutPhase[],
  currentSeconds: number
): VisualWorkoutState {
  if (timeline.length === 0) {
    throw new Error('Visual workout timeline requires at least one phase.')
  }

  const duration = timeline[timeline.length - 1].endSeconds
  const currentTime = clamp(
    Number.isFinite(currentSeconds) ? currentSeconds : 0,
    0,
    duration
  )
  let currentIndex = 0
  for (let index = 1; index < timeline.length; index += 1) {
    if (currentTime < timeline[index].startSeconds) break
    currentIndex = index
  }
  const current = timeline[currentIndex]
  const phaseDuration = Math.max(1, current.endSeconds - current.startSeconds)
  const elapsedInPhase = clamp(currentTime - current.startSeconds, 0, phaseDuration)

  return {
    current,
    next: timeline[currentIndex + 1] ?? null,
    phaseNumber: currentIndex + 1,
    totalPhases: timeline.length,
    actionNumber: current.actionNumber,
    totalActions: current.totalActions,
    remainingSeconds: Math.max(0, Math.ceil(current.endSeconds - currentTime)),
    phaseProgressPercent: Math.round((elapsedInPhase / phaseDuration) * 100),
    sessionProgressPercent: Math.round((currentTime / duration) * 100)
  }
}
