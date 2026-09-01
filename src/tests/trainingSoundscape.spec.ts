import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTrainingSoundscape,
  trainingBoundarySoundUrl,
  trainingSecondSoundUrl,
  trainingSoundscapeVolumes
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

  it('preloads all CDN players but stays silent during pretraining', () => {
    const createContext = vi.fn(createAudioContext)
    const soundscape = createTrainingSoundscape(createContext)

    soundscape.preload()
    soundscape.play('pretraining')
    vi.advanceTimersByTime(5000)

    expect(createContext).toHaveBeenCalledTimes(3)
    expect(createContext.mock.results.map(result => result.value.src)).toEqual([
      trainingSecondSoundUrl,
      trainingBoundarySoundUrl,
      trainingBoundarySoundUrl
    ])
    for (const result of createContext.mock.results) {
      expect(result.value.play).not.toHaveBeenCalled()
      expect(result.value.playbackRate).toBe(1)
    }
  })

  it('plays one pulse per formal second with prominent first and final pulses', () => {
    const secondContext = createAudioContext()
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(secondContext)
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext)
    const soundscape = createTrainingSoundscape(createContext)

    soundscape.play('formal', 4)

    expect(secondContext.src).toBe(trainingSecondSoundUrl)
    expect(secondContext.volume).toBe(trainingSoundscapeVolumes.second)
    expect(startingBoundaryContext.src).toBe(trainingBoundarySoundUrl)
    expect(startingBoundaryContext.volume).toBe(trainingSoundscapeVolumes.boundary)
    expect(startingBoundaryContext.play).toHaveBeenCalledTimes(1)
    expect(secondContext.play).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(secondContext.play).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(secondContext.play).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1000)
    expect(finalBoundaryContext.play).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(secondContext.play).toHaveBeenCalledTimes(2)
    expect(startingBoundaryContext.play).toHaveBeenCalledTimes(1)
    expect(finalBoundaryContext.play).toHaveBeenCalledTimes(1)
  })

  it('uses one boundary pulse for a one-second formal action', () => {
    const secondContext = createAudioContext()
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(secondContext)
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext))

    soundscape.play('formal', 1)
    vi.advanceTimersByTime(3000)

    expect(startingBoundaryContext.play).toHaveBeenCalledOnce()
    expect(finalBoundaryContext.play).not.toHaveBeenCalled()
    expect(secondContext.play).not.toHaveBeenCalled()
  })

  it('pauses scheduling while hidden and releases both players at session end', () => {
    const secondContext = createAudioContext()
    const startingBoundaryContext = createAudioContext()
    const finalBoundaryContext = createAudioContext()
    const soundscape = createTrainingSoundscape(vi.fn()
      .mockReturnValueOnce(secondContext)
      .mockReturnValueOnce(startingBoundaryContext)
      .mockReturnValueOnce(finalBoundaryContext))

    soundscape.play('formal', 3)
    soundscape.suspend()
    vi.advanceTimersByTime(2000)
    expect(secondContext.play).not.toHaveBeenCalled()

    soundscape.resume()
    vi.advanceTimersByTime(1000)
    expect(secondContext.play).toHaveBeenCalledOnce()
    soundscape.stop()

    expect(secondContext.destroy).toHaveBeenCalledOnce()
    expect(startingBoundaryContext.destroy).toHaveBeenCalledOnce()
    expect(finalBoundaryContext.destroy).toHaveBeenCalledOnce()
  })
})
