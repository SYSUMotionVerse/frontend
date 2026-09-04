import type { AnchoredTimelineRuntime } from './anchoredTimeline'

export interface TrainingAudioClockContext {
  currentTime: number
  /** `suspended` | `running` | `closed` where the platform exposes it. */
  state?: string
  resume?: () => Promise<void> | void
  suspend?: () => Promise<void> | void
  close?: () => Promise<void> | void
}


type TrainingAudioClockWechatApi = typeof wx & {
  createWebAudioContext?: () => TrainingAudioClockContext
}

function defaultWallNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function defaultCreateContext() {
  const api = typeof wx === 'undefined'
    ? null
    : wx as TrainingAudioClockWechatApi
  return api?.createWebAudioContext?.()
}

// How far a spontaneously re-advancing audio clock may sit from the wall-clock
// continuation before re-adoption is refused. Poll granularity alone can
// account for one timer interval, so stay generous.
const spontaneousReadoptToleranceMs = 250
// currentTime often moves in coarse steps on device; an unchanged reading is
// only treated as a suspension once it outlasts this window.
const stallGraceMs = 250

export interface TrainingAudioClockOptions {
  /** Injectable monotonic wall clock, for tests. */
  wallNowMs?: () => number
}

/**
 * The one clock used by phase transitions, speech cues and sound effects.
 * setTimeout only wakes the scheduler; AudioContext.currentTime determines
 * whether a configured boundary has actually been reached.
 *
 * The context is NOT created at setup: a WebAudioContext created before any
 * user gesture stays suspended on real devices, and a frozen currentTime
 * would hang every anchored timeline. `ensureContext()` must be called from
 * the start-training gesture. If the context later stalls, readings fall back
 * to the monotonic wall clock without moving the virtual timeline, and
 * `rebuildContext()` implements the official iOS 17.5+ close-and-recreate
 * remedy for contexts that refuse to resume.
 */
export function createTrainingAudioClock(
  createContext = defaultCreateContext,
  options: TrainingAudioClockOptions = {}
) {
  const wallNowMs = options.wallNowMs ?? defaultWallNowMs
  let context: TrainingAudioClockContext | undefined
  let contextClosed = false

  // Every reading continues one virtual timeline in the wall-clock epoch:
  // whichever source produces a reading is re-based onto the last reading,
  // because anchored schedulers capture origins from these values, and a
  // backwards jump would delay every scheduled event while a forwards jump
  // would fire them in a burst.
  let wallOffsetMs = 0
  let audioOffsetMs = 0
  let lastReadingMs = -1
  let audioTrusted = false
  let lastAudioSeconds = -1
  let lastAudioAdvanceWallMs = -Infinity
  // Armed by deliberate activations (ensure/rebuild/resume): the next
  // advancing audio reading re-adopts the audio source regardless of how far
  // it sits from the wall continuation.
  let adoptOnNextAdvance = false
  let lastTransitionLogMs = -Infinity

  function wallReadingMs() {
    return wallNowMs() - wallOffsetMs
  }

  function logTransition(message: string) {
    const wallNow = wallNowMs()
    if (wallNow - lastTransitionLogMs < 1000) return
    lastTransitionLogMs = wallNow
    console.info(`[TrainingAudioClock] ${message}`)
  }

  function pollAudioClock(): { ms: number; advanced: boolean } | undefined {
    if (!context || contextClosed) return undefined
    const seconds = context.currentTime
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
      return undefined
    }
    const wallNow = wallNowMs()
    if (seconds > lastAudioSeconds) {
      lastAudioSeconds = seconds
      lastAudioAdvanceWallMs = wallNow
      return { ms: seconds * 1000, advanced: true }
    }
    // A short unchanged stretch is clock quantization, not a suspension: hold
    // the last position instead of flapping to the wall clock.
    if (wallNow - lastAudioAdvanceWallMs <= stallGraceMs) {
      return { ms: seconds * 1000, advanced: false }
    }
    return undefined
  }

  function adoptAudioSource(audioMs: number) {
    const continueFrom = lastReadingMs >= 0 ? lastReadingMs : wallReadingMs()
    audioOffsetMs = audioMs - continueFrom
    audioTrusted = true
    adoptOnNextAdvance = false
    logTransition('audio clock adopted as the timeline source')
  }

  function readNowMs(): number {
    const reading = pollAudioClock()
    if (reading === undefined) {
      if (audioTrusted) {
        // The audio clock stalled: continue on the wall clock from the last
        // reading so deadlines anchored earlier stay valid.
        wallOffsetMs = wallNowMs() - lastReadingMs
        audioTrusted = false
        logTransition('audio clock stalled; wall fallback engaged')
      }
    } else if (reading.advanced && !audioTrusted) {
      const projectedMs = reading.ms - audioOffsetMs
      if (
        adoptOnNextAdvance
        || lastReadingMs < 0
        || Math.abs(projectedMs - wallReadingMs()) <= spontaneousReadoptToleranceMs
      ) {
        adoptAudioSource(reading.ms)
      }
    }

    const readingMs = audioTrusted && reading !== undefined
      ? reading.ms - audioOffsetMs
      : wallReadingMs()
    lastReadingMs = Math.max(readingMs, lastReadingMs)
    return lastReadingMs
  }

  function ensureContext(): TrainingAudioClockContext | undefined {
    if (context && !contextClosed) {
      void context.resume?.()
      return context
    }
    try {
      context = createContext() ?? undefined
      contextClosed = false
    } catch (error) {
      console.warn('[TrainingAudioClock] Web Audio clock unavailable:', error)
      context = undefined
    }
    if (context) {
      // Base libraries >= 2.25.3 require one resume() right after creation
      // even when the creation itself happened inside a user gesture.
      void context.resume?.()
      lastAudioSeconds = -1
      lastAudioAdvanceWallMs = wallNowMs()
      audioTrusted = false
      adoptOnNextAdvance = true
    }
    return context
  }

  /** Official remedy for contexts that refuse to resume (iOS 17.5+). */
  function rebuildContext(): TrainingAudioClockContext | undefined {
    const staleContext = context
    context = undefined
    contextClosed = true
    audioTrusted = false
    void staleContext?.close?.()
    return ensureContext()
  }

  function isContextHealthy(): boolean {
    if (!context || contextClosed) return false
    const state = context.state
    if (typeof state === 'string' && state !== 'running') return false
    // Only a context whose clock has demonstrably advanced may carry
    // scheduled audio: a suspended context would accept sources into a
    // frozen timeline and dump them all at once when (if) it resumes.
    return audioTrusted
  }

  const runtime: AnchoredTimelineRuntime = {
    now: readNowMs,
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: timer => clearTimeout(timer)
  }

  return {
    get context() {
      return context && !contextClosed ? context : undefined
    },
    runtime,
    nowMs: readNowMs,
    ensureContext,
    rebuildContext,
    isContextHealthy,
    resume() {
      // A deliberate resume (onShow, interruption end) may bring a suspended
      // context back; re-adopt it as soon as it advances again.
      adoptOnNextAdvance = true
      void context?.resume?.()
    },
    suspend() {
      void context?.suspend?.()
    },
    close() {
      void context?.close?.()
      context = undefined
      contextClosed = true
      audioTrusted = false
    }
  }
}
