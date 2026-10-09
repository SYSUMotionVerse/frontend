/**
 * Looping background music for a training session.
 *
 * The track deliberately uses its own InnerAudioContext instead of the shared
 * Web Audio context: a multi-minute song decoded to PCM would exceed the TTS
 * decoded-cue residency budget (~20MB) and does not need sample-precise
 * scheduling. Speech prominence is implemented by ducking this player's
 * volume while a TTS cue is active.
 */

export interface MusicAudioContextLike {
  src: string
  autoplay: boolean
  loop: boolean
  volume: number
  obeyMuteSwitch?: boolean
  play?: () => void
  pause?: () => void
  stop?: () => void
  destroy?: () => void
  onError?: (callback: (error: unknown) => void) => void
}

interface MusicRuntime {
  createInnerAudioContext?: () => MusicAudioContextLike
}

/** Fraction of the configured volume applied while a speech cue is playing. */
export const trainingMusicDuckRatio = 0.35
export const defaultTrainingMusicVolume = 0.25

export function resolveTrainingMusicVolume(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultTrainingMusicVolume
  }
  return Math.min(1, Math.max(0, value))
}

export function createTrainingMusicPlayer(
  createAudioContext = () => {
    const wechatApi = typeof wx === 'undefined'
      ? null
      : wx as MusicRuntime
    const wechatContext = wechatApi?.createInnerAudioContext?.()
    if (wechatContext) return wechatContext

    const uniApi = typeof uni === 'undefined'
      ? null
      : uni as unknown as MusicRuntime
    return uniApi?.createInnerAudioContext?.()
  }
) {
  let context: MusicAudioContextLike | undefined
  let baseVolume = defaultTrainingMusicVolume
  let ducked = false
  let playing = false
  let suspended = false
  let configuredUrl = ''

  function applyVolume() {
    if (!context) return
    try {
      context.volume = Number((baseVolume * (ducked ? trainingMusicDuckRatio : 1)).toFixed(3))
    } catch (error) {
      console.warn('[TrainingMusic] unable to set volume:', error)
    }
  }

  function ensureContext() {
    if (context) return context
    try {
      context = createAudioContext()
    } catch (error) {
      console.warn('[TrainingMusic] audio context unavailable:', error)
    }
    if (!context) return undefined
    context.autoplay = false
    context.loop = true
    context.obeyMuteSwitch = false
    context.volume = baseVolume
    context.src = configuredUrl
    context.onError?.(error => {
      console.warn('[TrainingMusic] playback failed:', error)
    })
    return context
  }

  const api = {
    /** Configure the looping track. Re-configuring replaces the source. */
    configure(audioUrl: string, volume: number | null | undefined) {
      const normalizedUrl = audioUrl.trim()
      baseVolume = resolveTrainingMusicVolume(volume)
      if (normalizedUrl === configuredUrl) {
        applyVolume()
        return
      }
      const wasPlaying = playing
      configuredUrl = normalizedUrl
      if (context) {
        try {
          context.stop?.()
          context.destroy?.()
        } catch {
          // The native player may already be gone.
        }
        context = undefined
      }
      if (wasPlaying && configuredUrl) api.play()
    },

    /** Start the loop inside the user gesture that begins the workout. */
    play() {
      playing = true
      if (!configuredUrl || suspended) return
      const player = ensureContext()
      if (!player) return
      try {
        player.play?.()
      } catch (error) {
        console.warn('[TrainingMusic] play failed:', error)
      }
    },

    /** Duck while a TTS cue occupies the mix; restore on cue end. */
    duck(active: boolean) {
      if (ducked === active) return
      ducked = active
      applyVolume()
    },

    suspend() {
      if (suspended) return
      suspended = true
      try {
        context?.pause?.()
      } catch {
        // Native pause is best-effort.
      }
    },

    resume() {
      if (!suspended) return
      suspended = false
      if (!playing || !configuredUrl) return
      try {
        context?.play?.()
      } catch (error) {
        console.warn('[TrainingMusic] resume failed:', error)
      }
    },

    stop() {
      playing = false
      suspended = false
      try {
        context?.stop?.()
      } catch {
        // Already stopped.
      }
    },

    destroy() {
      playing = false
      suspended = false
      configuredUrl = ''
      try {
        context?.stop?.()
        context?.destroy?.()
      } catch {
        // Best-effort release.
      }
      context = undefined
    },

    /** Test/diagnostic surface only. */
    isPlaying: () => playing
  }
  return api
}
