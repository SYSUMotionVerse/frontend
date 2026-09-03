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
  it('uses AudioContext currentTime as the shared authoritative clock', () => {
    const context = {
      currentTime: 12.25,
      resume: vi.fn(),
      suspend: vi.fn(),
      close: vi.fn()
    }
    const clock = createTrainingAudioClock(() => context)

    expect(clock.nowMs()).toBe(12_250)
    context.currentTime = 13.875
    expect(clock.runtime.now()).toBe(13_875)

    clock.resume()
    clock.suspend()
    clock.close()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.suspend).toHaveBeenCalledOnce()
    expect(context.close).toHaveBeenCalledOnce()
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
