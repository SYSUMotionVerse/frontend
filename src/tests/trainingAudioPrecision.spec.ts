import { describe, expect, it, vi } from 'vitest'
import {
  createAnchoredTimelineScheduler,
  resolveNextWholeSecondDelayMs,
  type AnchoredTimelineRuntime
} from '../uni-app/platform/anchoredTimeline'
import { createTrainingSoundscape } from '../uni-app/platform/trainingSoundscape'
import { createTrainingTtsPlayer } from '../uni-app/platform/trainingTts'
import { createTrainingAudioClock } from '../uni-app/platform/trainingAudioClock'

function createLateRuntime(latenessMs = 80) {
  let nowMs = 0
  let nextId = 0
  const timers = new Map<number, { atMs: number; callback: () => void }>()
  const runtime: AnchoredTimelineRuntime = {
    now: () => nowMs,
    setTimer(callback, delayMs) {
      nextId += 1
      timers.set(nextId, { atMs: nowMs + delayMs + latenessMs, callback })
      return nextId as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer(timer) {
      timers.delete(timer as unknown as number)
    }
  }
  return {
    runtime,
    now: () => nowMs,
    runNext() {
      const next = [...timers.entries()].sort((left, right) => left[1].atMs - right[1].atMs)[0]
      if (!next) return false
      timers.delete(next[0])
      nowMs = next[1].atMs
      next[1].callback()
      return true
    },
    runAll() {
      while (this.runNext()) {
        // Drain the finite track.
      }
    }
  }
}

describe('training audio precision', () => {
  it('does not create a context before the start gesture asks for one', () => {
    const createContext = vi.fn(() => undefined)
    const clock = createTrainingAudioClock(createContext, { wallNowMs: () => 1000 })

    // A WebAudioContext created outside a user gesture stays suspended on
    // real devices, so setup must stay context-free.
    expect(createContext).not.toHaveBeenCalled()
    expect(clock.context).toBeUndefined()
    expect(clock.nowMs()).toBe(1000)
    expect(clock.isContextHealthy()).toBe(false)

    clock.ensureContext()
    expect(createContext).toHaveBeenCalledOnce()
    expect(clock.context).toBeUndefined()
    expect(Number.isFinite(clock.nowMs())).toBe(true)
  })

  it('re-bases the shared audio clock onto the session timeline without a jump', () => {
    const context = {
      currentTime: 0.25,
      state: 'running',
      resume: vi.fn(),
      suspend: vi.fn(),
      close: vi.fn()
    }
    let wallMs = 50_000
    const clock = createTrainingAudioClock(() => context, { wallNowMs: () => wallMs })

    expect(clock.nowMs()).toBe(50_000)
    clock.ensureContext()
    expect(context.resume).toHaveBeenCalledOnce()

    // The first post-activation reading continues from the wall epoch instead
    // of jumping back to the raw AudioContext time.
    expect(clock.nowMs()).toBe(50_000)
    context.currentTime = 1.25
    wallMs = 51_000
    expect(clock.nowMs()).toBe(51_000)
    context.currentTime = 1.75
    wallMs = 99_000
    expect(clock.nowMs()).toBe(51_500)
    expect(clock.isContextHealthy()).toBe(true)

    clock.suspend()
    expect(context.suspend).toHaveBeenCalledOnce()
    clock.close()
    expect(context.close).toHaveBeenCalledOnce()
    expect(clock.isContextHealthy()).toBe(false)
  })

  it('falls back to the wall clock without moving the timeline when the context stalls', () => {
    const context = {
      currentTime: 0.5,
      state: 'running',
      resume: vi.fn(),
      suspend: vi.fn()
    }
    let wallMs = 10_000
    const clock = createTrainingAudioClock(() => context, { wallNowMs: () => wallMs })
    clock.ensureContext()
    expect(clock.nowMs()).toBe(10_000)

    // The context freezes mid-workout (suspended): readings continue from the
    // last value at wall rate, so anchored deadlines stay valid.
    context.state = 'suspended'
    wallMs = 12_000
    expect(clock.nowMs()).toBe(10_000)
    wallMs = 13_000
    expect(clock.nowMs()).toBe(11_000)
    expect(clock.isContextHealthy()).toBe(false)

    // A deliberate resume that recovers re-adopts the audio clock, still
    // without a backwards jump.
    clock.resume()
    context.state = 'running'
    context.currentTime = 3.5
    expect(clock.nowMs()).toBe(11_000)
    context.currentTime = 4.5
    wallMs = 14_000
    expect(clock.nowMs()).toBe(12_000)
    expect(clock.isContextHealthy()).toBe(true)
  })

  it('refuses to adopt a spontaneously advancing clock that lags the fallback', () => {
    const context = {
      currentTime: 1,
      state: 'running',
      resume: vi.fn()
    }
    let wallMs = 10_000
    const clock = createTrainingAudioClock(() => context, { wallNowMs: () => wallMs })
    clock.ensureContext()
    expect(clock.nowMs()).toBe(10_000)

    // Long unannounced stall: the wall continuation runs far ahead of the
    // audio clock, so a spontaneous advance must not be trusted.
    wallMs = 60_000
    expect(clock.nowMs()).toBe(10_000)
    wallMs = 62_000
    expect(clock.nowMs()).toBe(12_000)
    context.currentTime = 2
    wallMs = 63_000
    expect(clock.nowMs()).toBe(13_000)
    expect(clock.isContextHealthy()).toBe(false)

    // A deliberate resume re-adopts it, continuing seamlessly.
    clock.resume()
    expect(clock.nowMs()).toBe(13_000)
    context.currentTime = 3
    expect(clock.nowMs()).toBe(13_000)
    context.currentTime = 4
    wallMs = 64_000
    expect(clock.nowMs()).toBe(14_000)
    expect(clock.isContextHealthy()).toBe(true)
  })

  it('rebuilds a context that refuses to resume and re-anchors seamlessly', () => {
    const suspendedContext = {
      currentTime: 3,
      state: 'suspended',
      resume: vi.fn(),
      close: vi.fn()
    }
    const freshContext = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      close: vi.fn()
    }
    let wallMs = 20_000
    const clock = createTrainingAudioClock(vi.fn()
      .mockReturnValueOnce(suspendedContext)
      .mockReturnValueOnce(freshContext), { wallNowMs: () => wallMs })

    clock.ensureContext()
    expect(clock.nowMs()).toBe(20_000)

    // The context never advances again; the session falls back to wall time,
    // then rebuilds per the official iOS 17.5+ remedy.
    wallMs = 21_000
    expect(clock.nowMs()).toBe(20_000)
    wallMs = 22_000
    expect(clock.nowMs()).toBe(21_000)
    expect(suspendedContext.close).not.toHaveBeenCalled()

    const rebuilt = clock.rebuildContext()
    expect(rebuilt).toBe(freshContext)
    expect(suspendedContext.close).toHaveBeenCalledOnce()
    expect(freshContext.resume).toHaveBeenCalledOnce()

    expect(clock.nowMs()).toBe(21_000)
    freshContext.currentTime = 1
    wallMs = 23_000
    expect(clock.nowMs()).toBe(22_000)
    expect(clock.isContextHealthy()).toBe(true)
  })

  it('anchors every callback so repeated 80ms timer latency never accumulates', () => {
    const clock = createLateRuntime(80)
    const actualTimes: number[] = []
    const scheduler = createAnchoredTimelineScheduler<number>(clock.runtime)

    scheduler.start([
      { atMs: 0, value: 0 },
      { atMs: 1000, value: 1 },
      { atMs: 2000, value: 2 },
      { atMs: 3000, value: 3 }
    ], () => actualTimes.push(clock.now()))
    clock.runAll()

    expect(actualTimes).toEqual([0, 1080, 2080, 3080])
    expect(actualTimes.map((actual, index) => actual - index * 1000))
      .toEqual([0, 80, 80, 80])
  })

  it('keeps every timer display change on the immutable deadline clock', () => {
    const deadlineMs = 5000
    const callbackTimes: number[] = []
    let nowMs = 0
    while (nowMs < deadlineMs) {
      const delay = resolveNextWholeSecondDelayMs(deadlineMs, nowMs)
      nowMs += delay + 80
      callbackTimes.push(nowMs)
    }

    expect(callbackTimes).toEqual([1080, 2080, 3080, 4080, 5080])
    expect(callbackTimes.every((time, index) => time - (index + 1) * 1000 <= 100)).toBe(true)
  })

  it('keeps the sound-effect and speech tracks independent and within 100ms', () => {
    const soundClock = createLateRuntime(80)
    const speechClock = createLateRuntime(80)
    const soundTimes: number[] = []
    const speechTimes: number[] = []

    const soundscape = createTrainingSoundscape(() => ({
      src: '',
      autoplay: false,
      loop: false,
      volume: 1,
      play: vi.fn(() => soundTimes.push(soundClock.now())),
      stop: vi.fn(),
      destroy: vi.fn(),
      onError: vi.fn()
    }), soundClock.runtime)

    function speechContext() {
      let ended = () => {}
      return {
        src: '',
        autoplay: false,
        play: vi.fn(() => {
          speechTimes.push(speechClock.now())
          ended()
        }),
        stop: vi.fn(),
        destroy: vi.fn(),
        onEnded: vi.fn(callback => { ended = callback }),
        onError: vi.fn()
      }
    }
    const speech = createTrainingTtsPlayer(speechContext, null, speechClock.runtime)

    soundscape.play('formal', 6)
    speech.schedule([
      { time: 0, text: '开始', audio_url: 'start.mp3' },
      { time: 2, text: '提示', audio_url: 'tip.mp3' },
      { time: 5, text: '完成', audio_url: 'complete.mp3' }
    ])
    soundClock.runAll()
    speechClock.runAll()

    expect(soundTimes).toEqual([0, 1080, 2080, 3080, 4080, 5080])
    expect(speechTimes).toEqual([0, 2080, 5080])
    expect(soundTimes[0]).toBe(speechTimes[0])
    expect(soundTimes.slice(1).every((time, index) => (
      time - [1000, 2000, 3000, 4000, 5000][index] <= 100
    ))).toBe(true)
    expect(speechTimes.slice(1).every((time, index) => (
      time - [2000, 5000][index] <= 100
    ))).toBe(true)
  })

  it('fires a one-based second-17 cue when the visible clock reaches 17', () => {
    const clock = createLateRuntime(80)
    const speechTimes: number[] = []
    const speech = createTrainingTtsPlayer(() => {
      let ended = () => {}
      return {
        src: '',
        autoplay: false,
        play: vi.fn(() => {
          speechTimes.push(clock.now())
          ended()
        }),
        stop: vi.fn(),
        destroy: vi.fn(),
        onEnded: vi.fn(callback => { ended = callback }),
        onError: vi.fn()
      }
    }, null, clock.runtime)

    speech.schedule([
      // Configuration resolution maps visible second 17 to elapsed second 16.
      { time: 16, text: '第十七秒', audio_url: 'second-17.mp3' }
    ])
    clock.runAll()

    expect(speechTimes).toEqual([16_080])
  })
})
