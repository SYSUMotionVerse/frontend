import { describe, expect, it, vi } from 'vitest'
import {
  createTrainingSoundscape,
  trainingSoundscapeProfiles,
  trainingSoundscapeUrl
} from '../uni-app/platform/trainingSoundscape'

function createAudioContext() {
  return {
    src: '',
    autoplay: true,
    loop: false,
    volume: 1,
    playbackRate: 1,
    obeyMuteSwitch: true,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    onError: vi.fn()
  }
}

describe('trainingSoundscape', () => {
  it('loops the quiet pretraining rhythm and resumes without recreating it', () => {
    const context = createAudioContext()
    const createContext = vi.fn(() => context)
    const soundscape = createTrainingSoundscape(createContext)

    soundscape.play('pretraining')
    soundscape.play('pretraining')
    soundscape.suspend()
    soundscape.resume()

    expect(createContext).toHaveBeenCalledOnce()
    expect(context.src).toBe(trainingSoundscapeUrl)
    expect(context.loop).toBe(true)
    expect(context.volume).toBe(trainingSoundscapeProfiles.pretraining.volume)
    expect(context.playbackRate).toBe(0.5)
    expect(context.pause).toHaveBeenCalledOnce()
    expect(context.play).toHaveBeenCalledTimes(2)
  })

  it('changes rate and volume without restarting at formal training', () => {
    const context = createAudioContext()
    const createContext = vi.fn(() => context)
    const soundscape = createTrainingSoundscape(createContext)

    soundscape.play('pretraining')
    soundscape.play('formal')

    expect(createContext).toHaveBeenCalledOnce()
    expect(context.src).toBe(trainingSoundscapeUrl)
    expect(context.playbackRate).toBe(trainingSoundscapeProfiles.formal.playbackRate)
    expect(context.volume).toBe(trainingSoundscapeProfiles.formal.volume)
    expect(context.play).toHaveBeenCalledOnce()
    expect(context.stop).not.toHaveBeenCalled()
    expect(context.destroy).not.toHaveBeenCalled()
  })

  it('stops and destroys the loop when the session ends', () => {
    const context = createAudioContext()
    const soundscape = createTrainingSoundscape(() => context)

    soundscape.play('formal')
    soundscape.stop()

    expect(context.stop).toHaveBeenCalledOnce()
    expect(context.destroy).toHaveBeenCalledOnce()
  })
})
