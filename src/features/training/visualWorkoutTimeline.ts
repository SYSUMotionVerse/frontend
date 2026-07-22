import type { ExerciseArrangementItem } from '../../uni-app/api/studentBackendTypes'

export type VisualTrainingPlaybackState = 'idle' | 'playing' | 'paused' | 'ended'
export type VisualWorkoutPhaseKind = 'preview' | 'active' | 'rest' | 'demonstration' | 'countdown'

export const initialPreviewDurationSeconds = 15
export const initialStartCountdownSeconds = 3
export const startCueCountdownSeconds = 3

export interface VisualWorkoutPhase {
  id: string
  kind: VisualWorkoutPhaseKind
  itemIndex: number
  actionNumber: number
  totalActions: number
  title: string
  coachCue: string
  startSeconds: number
  endSeconds: number
  countdownDuration: number
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

function normalizeDuration(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

export function buildVisualWorkoutTimeline(items: ExerciseArrangementItem[]): VisualWorkoutPhase[] {
  const orderedItems = [...items].sort((left, right) => left.order - right.order)
  const phases: VisualWorkoutPhase[] = []
  let cursor = 0

  function appendPhase(
    item: ExerciseArrangementItem,
    itemIndex: number,
    kind: VisualWorkoutPhaseKind,
    duration: number,
    title: string,
    coachCue: string,
    countdownDuration = 0
  ) {
    if (duration <= 0) return
    phases.push({
      id: `${item.id}-${kind}`,
      kind,
      itemIndex,
      actionNumber: itemIndex + 1,
      totalActions: orderedItems.length,
      title,
      coachCue,
      startSeconds: cursor,
      endSeconds: cursor + duration,
      countdownDuration
    })
    cursor += duration
  }

  if (orderedItems[0]) {
    appendPhase(
      orderedItems[0],
      0,
      'preview',
      initialPreviewDurationSeconds,
      `准备：${orderedItems[0].video.title}`,
      '先看动作示范，倒计时结束后开始跟练'
    )
  }

  orderedItems.forEach((item, itemIndex) => {
    const actionTitle = item.video.title
    appendPhase(
      item,
      itemIndex,
      'active',
      Math.max(1, normalizeDuration(item.expected_duration)),
      actionTitle,
      item.video.description?.trim() || '跟随示范，优先保证动作完整',
      normalizeDuration(item.countdown_duration)
    )
    if (itemIndex < orderedItems.length - 1) {
      const nextItem = orderedItems[itemIndex + 1]
      appendPhase(
        nextItem,
        itemIndex + 1,
        'rest',
        normalizeDuration(item.rest_duration),
        `休息，准备：${nextItem.video.title}`,
        `下一训练步骤：${nextItem.video.title}`
      )
      appendPhase(
        nextItem,
        itemIndex + 1,
        'demonstration',
        normalizeDuration(nextItem.video.duration ?? 0),
        `动作示范：${nextItem.video.title}`,
        '完整观看一次动作示范，暂时不用跟练'
      )
      appendPhase(
        nextItem,
        itemIndex + 1,
        'countdown',
        startCueCountdownSeconds,
        `准备开始：${nextItem.video.title}`,
        '倒计时结束后正式跟练'
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
