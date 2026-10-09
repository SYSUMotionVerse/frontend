import { describe, expect, it, vi } from 'vitest'
import {
  createTrainingMusicPlayer,
  defaultTrainingMusicVolume,
  resolveTrainingMusicVolume,
  trainingMusicDuckRatio
} from '../uni-app/platform/trainingMusic'

function createAudioContext() {
  return {
    src: '',
    autoplay: false,
    loop: false,
    volume: 1,
    obeyMuteSwitch: true,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    onError: vi.fn()
  }
}

describe('trainingMusic', () => {
  it('clamps the configured volume into 0..1 and defaults invalid input', () => {
    expect(resolveTrainingMusicVolume(0.4)).toBe(0.4)
    expect(resolveTrainingMusicVolume(-0.5)).toBe(0)
    expect(resolveTrainingMusicVolume(1.8)).toBe(1)
    expect(resolveTrainingMusicVolume(undefined)).toBe(defaultTrainingMusicVolume)
    expect(resolveTrainingMusicVolume(Number.NaN)).toBe(defaultTrainingMusicVolume)
  })

  it('loops the configured track inside the start gesture', () => {
    const context = createAudioContext()
    const player = createTrainingMusicPlayer(() => context)

    player.configure(' https://cdn.example.com/bed.mp3 ', 0.3)
    player.play()

    expect(context.src).toBe('https://cdn.example.com/bed.mp3')
    expect(context.loop).toBe(true)
    expect(context.obeyMuteSwitch).toBe(false)
    expect(context.autoplay).toBe(false)
    expect(context.volume).toBeCloseTo(0.3)
    expect(context.play).toHaveBeenCalledOnce()
  })

  it('does not create a player before play or without a configured url', () => {
    const createContext = vi.fn(createAudioContext)
    const player = createTrainingMusicPlayer(createContext)

    player.configure('', 0.5)
    player.play()

    expect(createContext).not.toHaveBeenCalled()
  })

  it('ducks the volume while a speech cue is active and restores after', () => {
    const context = createAudioContext()
    const player = createTrainingMusicPlayer(() => context)

    player.configure('https://cdn.example.com/bed.mp3', 0.4)
    player.play()
    player.duck(true)

    expect(context.volume).toBeCloseTo(0.4 * trainingMusicDuckRatio)

    player.duck(false)
    expect(context.volume).toBeCloseTo(0.4)
  })

  it('keeps the duck level across pause/resume cycles', () => {
    const context = createAudioContext()
    const player = createTrainingMusicPlayer(() => context)

    player.configure('https://cdn.example.com/bed.mp3', 0.2)
    player.play()
    player.duck(true)
    player.suspend()
    player.resume()

    expect(context.pause).toHaveBeenCalledOnce()
    expect(context.play).toHaveBeenCalledTimes(2)
    expect(context.volume).toBeCloseTo(0.2 * trainingMusicDuckRatio)
  })

  it('does not resume when it was never playing', () => {
    const context = createAudioContext()
    const player = createTrainingMusicPlayer(() => context)

    player.configure('https://cdn.example.com/bed.mp3', 0.5)
    player.suspend()
    player.resume()

    expect(context.play).not.toHaveBeenCalled()
  })

  it('replaces the context when the configured track changes mid-session', () => {
    const first = createAudioContext()
    const second = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const player = createTrainingMusicPlayer(createContext)

    player.configure('https://cdn.example.com/a.mp3', 0.5)
    player.play()
    player.configure('https://cdn.example.com/b.mp3', 0.6)

    expect(first.stop).toHaveBeenCalled()
    expect(first.destroy).toHaveBeenCalled()
    expect(second.src).toBe('https://cdn.example.com/b.mp3')
    expect(second.volume).toBeCloseTo(0.6)
    expect(second.play).toHaveBeenCalledOnce()
  })

  it('releases the context on destroy and never replays it', () => {
    const context = createAudioContext()
    const player = createTrainingMusicPlayer(() => context)

    player.configure('https://cdn.example.com/bed.mp3', 0.5)
    player.play()
    player.destroy()

    expect(context.destroy).toHaveBeenCalled()
    player.play()
    expect(context.play).toHaveBeenCalledOnce()
  })
})
