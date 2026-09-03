import type { AnchoredTimelineRuntime } from './anchoredTimeline'

export interface TrainingAudioClockContext {
  currentTime: number
  resume?: () => Promise<void> | void
  suspend?: () => Promise<void> | void
  close?: () => Promise<void> | void
}


type TrainingAudioClockWechatApi = typeof wx & {
  createWebAudioContext?: () => TrainingAudioClockContext
}

function fallbackNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/**
 * The one clock used by phase transitions, speech cues and sound effects.
 * setTimeout only wakes the scheduler; AudioContext.currentTime determines
 * whether a configured boundary has actually been reached.
 */
export function createTrainingAudioClock(
  createContext = () => {
    const api = typeof wx === 'undefined'
      ? null
      : wx as TrainingAudioClockWechatApi
    return api?.createWebAudioContext?.()
  }
) {
  let context: TrainingAudioClockContext | undefined
  try {
    context = createContext()
  } catch (error) {
    console.warn('[TrainingAudioClock] Web Audio clock unavailable:', error)
  }

  const runtime: AnchoredTimelineRuntime = {
    now: () => context ? context.currentTime * 1000 : fallbackNowMs(),
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: timer => clearTimeout(timer)
  }

  return {
    context,
    runtime,
    nowMs: runtime.now,
    resume() {
      void context?.resume?.()
    },
    suspend() {
      void context?.suspend?.()
    },
    close() {
      void context?.close?.()
      context = undefined
    }
  }
}
