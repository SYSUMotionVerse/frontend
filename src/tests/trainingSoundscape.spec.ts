import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildTrainingSoundEffectTrack,
  createTrainingSoundscape,
  trainingBoundarySoundUrl,
  trainingSecondSoundUrl,
  trainingSoundscapeVolumes,
  type TrainingWebAudioContextLike
} from '../uni-app/platform/trainingSoundscape'

function createAudioContext() {
  return {
    src: '',
    autoplay: true,
    loop: true,
    volume: 0,
    playbackRate: 0,
    obeyMuteSwitch: true,
    play: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    destroy: vi.fn(),
    onError: vi.fn()
  }
}

describe('trainingSoundscape', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('preloads all CDN players and stays silent outside the pretraining tail', () => {
    const createContext = vi.fn(createAudioContext)
    const soundscape = createTrainingSoundscape(createContext)

    soundscape.preload()
    soundscape.play('pretraining')
    vi.advanceTimersByTime(5000)

    expect(createContext).toHaveBeenCalledTimes(4)
    expect(createContext.mock.results.map(result => result.value.src)).toEqual([
      trainingSecondSoundUrl,
      trainingSecondSoundUrl,
      trainingBoundarySoundUrl,
      trainingBoundarySoundUrl
    ])
    for (const result of createContext.mock.results) {
      expect(result.value.play).not.toHaveBeenCalled()
      expect(result.value.playbackRate).toBe(1)
    }
  })

  it('plays one start boundary before the final-three-second pretraining tail', () => {
    const firstSecondContext = createAudioContext()
    const secondSecondContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(firstSecondContext)
      .mockReturnValueOnce(secondSecondContext)
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(createAudioContext()))

    soundscape.play('pretraining', 5)
    expect(firstSecondContext.play).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1999)
    expect(firstSecondContext.play).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(firstSecondContext.play).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(firstSecondContext.play).toHaveBeenCalledTimes(2)
    expect(secondSecondContext.play).toHaveBeenCalledTimes(1)
  })

  it('plays a start boundary and an ordinary cue on every remaining formal second', () => {
    const firstSecondContext = createAudioContext()
    const secondSecondContext = createAudioContext()
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(firstSecondContext)
      .mockReturnValueOnce(secondSecondContext)
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext)
    const soundscape = createTrainingSoundscape(createContext)

    soundscape.play('formal', 4)

    expect(firstSecondContext.src).toBe(trainingSecondSoundUrl)
    expect(firstSecondContext.volume).toBe(trainingSoundscapeVolumes.second)
    expect(startingBoundaryContext.src).toBe(trainingBoundarySoundUrl)
    expect(startingBoundaryContext.volume).toBe(trainingSoundscapeVolumes.boundary)
    expect(startingBoundaryContext.play).toHaveBeenCalledTimes(1)
    expect(firstSecondContext.play).not.toHaveBeenCalled()
    expect(firstSecondContext.stop).not.toHaveBeenCalled()
    expect(secondSecondContext.stop).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(firstSecondContext.play).toHaveBeenCalledTimes(1)
    expect(secondSecondContext.stop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(secondSecondContext.play).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(firstSecondContext.play).toHaveBeenCalledTimes(2)
    expect(finalBoundaryContext.play).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(finalBoundaryContext.play).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(firstSecondContext.play).toHaveBeenCalledTimes(2)
    expect(secondSecondContext.play).toHaveBeenCalledTimes(1)
    expect(startingBoundaryContext.play).toHaveBeenCalledTimes(1)
    expect(finalBoundaryContext.play).not.toHaveBeenCalled()
  })

  it('does not lose an ordinary cue when a native player rejects consecutive play calls', () => {
    let audiblePulses = 0
    function createStrictSecondContext() {
      let ready = true
      let hasPlayed = false
      return {
        ...createAudioContext(),
        play: vi.fn(() => {
          if (!ready) return
          ready = false
          hasPlayed = true
          audiblePulses += 1
        }),
        // Model the WeChat failure observed on-device: stopping an idle,
        // merely preloaded context poisons its first subsequent play call.
        stop: vi.fn(() => { ready = hasPlayed })
      }
    }
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(createStrictSecondContext())
      .mockReturnValueOnce(createStrictSecondContext())
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(createAudioContext()))

    soundscape.play('formal', 6)
    vi.advanceTimersByTime(5000)

    expect(audiblePulses).toBe(5)
  })

  it('submits the complete formal track to the Web Audio sample clock up front', async () => {
    const starts: number[] = []
    const stops: number[] = []
    const fallbackFactory = vi.fn(createAudioContext)
    const jsTimer = vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>)
    const webAudioContext: TrainingWebAudioContextLike = {
      currentTime: 42.5,
      destination: {},
      createBufferSource: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(when => starts.push(when ?? 0)),
        stop: vi.fn(when => stops.push(when ?? 0))
      }),
      createGain: () => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      decodeAudioData(data, success) {
        success?.({ data })
      },
      resume: vi.fn(),
      suspend: vi.fn(),
      close: vi.fn()
    }
    const soundscape = createTrainingSoundscape(
      fallbackFactory,
      {
        now: () => 0,
        setTimer: jsTimer,
        clearTimer: vi.fn()
      },
      {
        createContext: () => webAudioContext,
        loadArrayBuffer: async () => new ArrayBuffer(1)
      }
    )

    await soundscape.preload()
    soundscape.play('formal', 4)

    expect(starts).toEqual([42.5, 43.5, 44.5, 45.5])
    // WeChat can treat stop(futureTime), issued immediately after a scheduled
    // start(), as an early cancellation. One-shot samples must end naturally.
    expect(stops).toEqual([])
    expect(jsTimer).not.toHaveBeenCalled()
    expect(fallbackFactory).not.toHaveBeenCalled()
  })

  it('plays the full final second before the next phase boundary', async () => {
    const starts: number[] = []
    const stopped: Array<{ startsAt: number; stopsAt: number }> = []
    const context: TrainingWebAudioContextLike = {
      currentTime: 100,
      destination: {},
      createBufferSource: () => {
        let startsAt = -1
        return {
          connect: vi.fn(),
          start: vi.fn(when => {
            startsAt = when ?? context.currentTime
            starts.push(startsAt)
          }),
          stop: vi.fn(when => stopped.push({
            startsAt,
            stopsAt: when ?? context.currentTime
          }))
        }
      },
      decodeAudioData(data, success) {
        success?.({ data })
      }
    }
    const soundscape = createTrainingSoundscape(
      vi.fn(createAudioContext),
      undefined,
      {
        createContext: () => context,
        loadArrayBuffer: async () => new ArrayBuffer(1)
      }
    )

    await soundscape.preload()
    soundscape.play('pretraining', 3)
    // The three configured seconds are [100, 103): boundary at 100 and
    // ordinary final-second cues at 101 and 102.
    context.currentTime = 103
    soundscape.finish()
    soundscape.play('formal', 2)

    expect(starts).toEqual([100, 101, 102, 103, 104])
    expect(stopped.every(stop => stop.stopsAt >= stop.startsAt)).toBe(true)
  })

  it('precomputes every formal beat and only the pretraining final-three-second tail', () => {
    const formal = buildTrainingSoundEffectTrack('formal', 8)
    expect(formal.map(slot => slot.second)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(formal.map(slot => slot.atMs)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000])
    expect(formal.map(slot => slot.effect)).toEqual([
      'boundary',
      'second',
      'second',
      'second',
      'second',
      'second',
      'second',
      'second'
    ])
    const pretraining = buildTrainingSoundEffectTrack('pretraining', 5)
    expect(pretraining.map(slot => slot.second)).toEqual([1, 2, 3, 4, 5])
    expect(pretraining.map(slot => slot.effect)).toEqual([
      'boundary',
      null,
      'second',
      'second',
      'second'
    ])
  })

  it('uses one start boundary pulse for a one-second formal action', () => {
    const secondContext = createAudioContext()
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(secondContext)
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext))

    soundscape.play('formal', 1)
    vi.advanceTimersByTime(3000)

    expect(startingBoundaryContext.play).toHaveBeenCalledOnce()
    expect(finalBoundaryContext.play).not.toHaveBeenCalled()
    expect(secondContext.play).not.toHaveBeenCalled()
  })

  it('plays the final session boundary without stopping its audible tail', () => {
    const finalBoundaryContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(finalBoundaryContext))

    soundscape.play('formal', 5)
    finalBoundaryContext.stop.mockClear()
    soundscape.finish(true)

    expect(finalBoundaryContext.play).toHaveBeenCalledOnce()
    expect(finalBoundaryContext.stop).not.toHaveBeenCalled()
  })

  it.each([
    ['pretraining', 'pretraining'],
    ['pretraining', 'formal'],
    ['formal', 'pretraining'],
    ['formal', 'formal']
  ] as const)('plays exactly one boundary at each %s -> %s phase start', (previous, following) => {
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(createAudioContext())
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext))

    soundscape.play(previous, 5)
    soundscape.finish()
    soundscape.play(following, 5)

    expect(startingBoundaryContext.play).toHaveBeenCalledTimes(2)
    expect(finalBoundaryContext.play).not.toHaveBeenCalled()
  })

  it('pauses scheduling while hidden and releases both players at session end', () => {
    const secondContext = createAudioContext()
    const alternateSecondContext = createAudioContext()
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(secondContext)
      .mockReturnValueOnce(alternateSecondContext)
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext))

    soundscape.play('formal', 3)
    soundscape.suspend()
    vi.advanceTimersByTime(2000)
    expect(secondContext.play).not.toHaveBeenCalled()

    soundscape.resume()
    vi.advanceTimersByTime(1000)
    expect(secondContext.play).toHaveBeenCalledOnce()
    soundscape.destroy()

    expect(secondContext.destroy).toHaveBeenCalledOnce()
    expect(alternateSecondContext.destroy).toHaveBeenCalledOnce()
    expect(startingBoundaryContext.destroy).toHaveBeenCalledOnce()
    expect(finalBoundaryContext.destroy).toHaveBeenCalledOnce()
  })
})
