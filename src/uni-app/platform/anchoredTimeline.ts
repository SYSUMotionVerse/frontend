export interface AnchoredTimelineEvent<T> {
  atMs: number
  value: T
}

export interface AnchoredTimelineRuntime {
  now: () => number
  setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void
}

const defaultRuntime: AnchoredTimelineRuntime = {
  now: () => Date.now(),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: timer => clearTimeout(timer)
}

export function resolveNextWholeSecondDelayMs(deadlineMs: number, nowMs: number) {
  const remainingMs = Math.max(0, deadlineMs - nowMs)
  const nextRemainingSecond = Math.max(0, Math.ceil(remainingMs / 1000) - 1)
  const nextBoundaryMs = deadlineMs - nextRemainingSecond * 1000
  return Math.max(0, nextBoundaryMs - nowMs)
}

/**
 * Run a finite sequence against one immutable clock origin.
 *
 * A callback that is 80 ms late shortens the following delay by 80 ms. The
 * lateness therefore never accumulates as it would with setInterval or with a
 * timeout scheduled relative to the preceding callback.
 */
export function createAnchoredTimelineScheduler<T>(
  runtime: AnchoredTimelineRuntime = defaultRuntime
) {
  let events: AnchoredTimelineEvent<T>[] = []
  let emit: ((value: T, scheduledAtMs: number) => void) | null = null
  let complete: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let originMs = 0
  let pausedElapsedMs = 0
  let nextIndex = 0
  let running = false
  let suspended = false

  function clearScheduledTimer() {
    if (timer === null) return
    runtime.clearTimer(timer)
    timer = null
  }

  function finish() {
    clearScheduledTimer()
    running = false
    suspended = false
    const onComplete = complete
    complete = null
    onComplete?.()
  }

  function scheduleNext() {
    clearScheduledTimer()
    if (!running || suspended) return
    if (nextIndex >= events.length) {
      finish()
      return
    }

    const targetMs = originMs + events[nextIndex].atMs
    timer = runtime.setTimer(runDueEvents, Math.max(0, targetMs - runtime.now()))
  }

  function runDueEvents() {
    timer = null
    if (!running || suspended) return

    const elapsedMs = Math.max(0, runtime.now() - originMs)
    while (nextIndex < events.length && events[nextIndex].atMs <= elapsedMs) {
      const event = events[nextIndex]
      nextIndex += 1
      emit?.(event.value, originMs + event.atMs)
    }
    scheduleNext()
  }

  function stop() {
    clearScheduledTimer()
    events = []
    emit = null
    complete = null
    nextIndex = 0
    running = false
    suspended = false
    pausedElapsedMs = 0
  }

  return {
    start(
      sourceEvents: readonly AnchoredTimelineEvent<T>[],
      onEvent: (value: T, scheduledAtMs: number) => void,
      options: { elapsedMs?: number; onComplete?: () => void } = {}
    ) {
      stop()
      const elapsedMs = Math.max(0, options.elapsedMs ?? 0)
      events = sourceEvents
        .filter(event => Number.isFinite(event.atMs) && event.atMs >= 0)
        .slice()
        .sort((left, right) => left.atMs - right.atMs)
      emit = onEvent
      complete = options.onComplete ?? null
      originMs = runtime.now() - elapsedMs
      pausedElapsedMs = elapsedMs
      running = events.length > 0
      if (!running) {
        const onComplete = complete
        complete = null
        onComplete?.()
        return
      }

      // Events at t=0 are dispatched synchronously, before another track or
      // the phase clock can race past the phase boundary.
      runDueEvents()
    },
    suspend() {
      if (!running || suspended) return
      pausedElapsedMs = Math.max(0, runtime.now() - originMs)
      suspended = true
      clearScheduledTimer()
    },
    resume() {
      if (!running || !suspended) return
      originMs = runtime.now() - pausedElapsedMs
      suspended = false
      runDueEvents()
    },
    stop,
    isRunning() {
      return running
    }
  }
}
