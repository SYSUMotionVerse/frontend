export type TrainingSoundscapeTrack = 'pretraining' | 'formal'

export const trainingSoundscapeUrl =
  'https://cdn.sysusports.cn/training-tts/sounds/formal-metronome-120bpm.mp3'

export const trainingSoundscapeProfiles: Record<
  TrainingSoundscapeTrack,
  { playbackRate: number; volume: number }
> = {
  // The same 120 BPM asset becomes a calmer 60 BPM rest/pretraining pulse.
  pretraining: { playbackRate: 0.5, volume: 0.1 },
  formal: { playbackRate: 1, volume: 0.16 }
}

interface LoopingAudioContextLike {
  src: string
  autoplay: boolean
  loop: boolean
  volume: number
  playbackRate: number
  obeyMuteSwitch?: boolean
  play?: () => void
  pause?: () => void
  stop?: () => void
  destroy?: () => void
  onError?: (callback: (error: unknown) => void) => void
}

interface SoundscapeRuntime {
  createInnerAudioContext?: () => LoopingAudioContextLike
}

type WechatSoundscapeFactory = typeof wx & SoundscapeRuntime

export function createTrainingSoundscape(
  createAudioContext = () => {
    const wechatApi = typeof wx === 'undefined'
      ? null
      : wx as WechatSoundscapeFactory
    const wechatContext = wechatApi?.createInnerAudioContext?.()
    if (wechatContext) return wechatContext

    const uniApi = typeof uni === 'undefined'
      ? null
      : uni as unknown as SoundscapeRuntime
    return uniApi?.createInnerAudioContext?.()
  }
) {
  let context: LoopingAudioContextLike | undefined
  let suspended = false

  function release() {
    const current = context
    context = undefined
    suspended = false
    current?.stop?.()
    current?.destroy?.()
  }

  function play(nextTrack: TrainingSoundscapeTrack) {
    const profile = trainingSoundscapeProfiles[nextTrack]
    if (context) {
      // This is one continuous independent track. Phase/action hand-offs only
      // tune its rhythm and loudness; they must never recreate or seek it.
      context.playbackRate = profile.playbackRate
      context.volume = profile.volume
      return
    }

    let nextContext: LoopingAudioContextLike | undefined
    try {
      nextContext = createAudioContext()
    } catch (error) {
      console.warn('[TrainingSoundscape] audio context unavailable:', error)
    }
    if (!nextContext) return

    context = nextContext
    nextContext.autoplay = false
    nextContext.loop = true
    nextContext.volume = profile.volume
    nextContext.playbackRate = profile.playbackRate
    nextContext.obeyMuteSwitch = false
    nextContext.src = trainingSoundscapeUrl
    nextContext.onError?.(error => {
      if (context !== nextContext) return
      console.warn('[TrainingSoundscape] playback failed:', error)
      release()
    })
    try {
      nextContext.play?.()
    } catch (error) {
      console.warn('[TrainingSoundscape] playback setup failed:', error)
      release()
    }
  }

  return {
    play,
    suspend() {
      if (!context || suspended) return
      suspended = true
      context.pause?.()
    },
    resume() {
      if (!context || !suspended) return
      suspended = false
      context.play?.()
    },
    stop: release
  }
}
