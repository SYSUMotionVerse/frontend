export type TrainingSoundscapeTrack = 'pretraining' | 'formal'

export const trainingSecondSoundUrl =
  'https://cdn.sysusports.cn/training-tts/sounds/formal-second.mp3'
export const trainingBoundarySoundUrl =
  'https://cdn.sysusports.cn/training-tts/sounds/formal-boundary.mp3'
export const trainingSoundscapeVolumes = {
  second: 0.92,
  boundary: 1
} as const

interface PulseAudioContextLike {
  src: string
  autoplay: boolean
  loop: boolean
  volume: number
  playbackRate?: number
  obeyMuteSwitch?: boolean
  play?: () => void
  stop?: () => void
  seek?: (position: number) => void
  destroy?: () => void
  onError?: (callback: (error: unknown) => void) => void
}

interface SoundscapeRuntime {
  createInnerAudioContext?: () => PulseAudioContextLike
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
  let secondContext: PulseAudioContextLike | undefined
  let startingBoundaryContext: PulseAudioContextLike | undefined
  let finalBoundaryContext: PulseAudioContextLike | undefined
  let pulseTimer: ReturnType<typeof setTimeout> | null = null
  let totalPulses = 0
  let nextPulseIndex = 0
  let formalStartedAtMs = 0
  let lastPulseAtMs = 0
  let suspendedAtMs = 0
  let formalActive = false
  let suspended = false

  function clearPulseTimer() {
    if (!pulseTimer) return
    clearTimeout(pulseTimer)
    pulseTimer = null
  }

  function createPulseContext(src: string, volume: number) {
    let context: PulseAudioContextLike | undefined
    try {
      context = createAudioContext()
    } catch (error) {
      console.warn('[TrainingSoundscape] audio context unavailable:', error)
    }
    if (!context) return undefined

    context.autoplay = false
    context.loop = false
    context.volume = volume
    context.playbackRate = 1
    context.obeyMuteSwitch = false
    context.src = src
    context.onError?.(error => {
      console.warn('[TrainingSoundscape] playback failed:', error)
    })
    return context
  }

  function ensureContexts() {
    secondContext ??= createPulseContext(
      trainingSecondSoundUrl,
      trainingSoundscapeVolumes.second
    )
    startingBoundaryContext ??= createPulseContext(
      trainingBoundarySoundUrl,
      trainingSoundscapeVolumes.boundary
    )
    // The first boundary cue can still have an audible tail when a very short
    // action ends, so the final cue gets its own preloaded player.
    finalBoundaryContext ??= createPulseContext(
      trainingBoundarySoundUrl,
      trainingSoundscapeVolumes.boundary
    )
  }

  function stopActivePulses() {
    secondContext?.stop?.()
    startingBoundaryContext?.stop?.()
    finalBoundaryContext?.stop?.()
  }

  function stopOtherPulses(active: PulseAudioContextLike) {
    if (secondContext !== active) secondContext?.stop?.()
    if (startingBoundaryContext !== active) startingBoundaryContext?.stop?.()
    if (finalBoundaryContext !== active) finalBoundaryContext?.stop?.()
  }

  function playPulse(context: PulseAudioContextLike | undefined) {
    if (!context) return
    try {
      // Never let the longer boundary cue overlap the following whole-second
      // cue. Overlap sounds like an unstable or double-speed metronome.
      // Do not stop the player that is about to play: stop/play is an
      // asynchronous state transition on real WeChat devices and can race.
      stopOtherPulses(context)
      context.play?.()
    } catch (error) {
      console.warn('[TrainingSoundscape] playback setup failed:', error)
    }
  }

  function emitNextPulse() {
    if (!formalActive || suspended || nextPulseIndex >= totalPulses) {
      clearPulseTimer()
      return
    }

    const isFirst = nextPulseIndex === 0
    const isFinal = nextPulseIndex === totalPulses - 1
    playPulse(
      isFirst
        ? startingBoundaryContext
        : isFinal
          ? finalBoundaryContext
          : secondContext
    )
    lastPulseAtMs = Date.now()
    nextPulseIndex += 1
    if (nextPulseIndex >= totalPulses) clearPulseTimer()
  }

  function scheduleRemainingPulses() {
    clearPulseTimer()
    if (!formalActive || suspended || nextPulseIndex >= totalPulses) return
    // Anchor every pulse to formal-training time rather than chaining one
    // interval after another. The last-pulse guard prevents a delayed callback
    // from being followed by a rapid catch-up pulse.
    const anchoredAt = formalStartedAtMs + nextPulseIndex * 1000
    const noEarlierThan = lastPulseAtMs + 1000
    const delay = Math.max(0, Math.max(anchoredAt, noEarlierThan) - Date.now())
    pulseTimer = setTimeout(() => {
      pulseTimer = null
      emitNextPulse()
      scheduleRemainingPulses()
    }, delay)
  }

  function resetFormalState() {
    formalActive = false
    suspended = false
    totalPulses = 0
    nextPulseIndex = 0
    formalStartedAtMs = 0
    lastPulseAtMs = 0
    suspendedAtMs = 0
    clearPulseTimer()
  }

  function enterPretraining() {
    // Pretraining is intentionally silent, including the tail of the final
    // formal-training boundary cue.
    stopActivePulses()
    resetFormalState()
  }

  function startFormal(durationSeconds: number) {
    // The preceding pretraining transition already stopped stale audio. Only
    // reset scheduling here so the first preloaded player is never subjected
    // to an immediate stop/play race.
    resetFormalState()
    ensureContexts()
    formalActive = true
    totalPulses = Math.max(1, Math.ceil(durationSeconds))
    formalStartedAtMs = Date.now()
    // A duration of N seconds receives exactly N pulses at t=0..N-1. The
    // first and final pulse use the more prominent boundary sound.
    emitNextPulse()
    scheduleRemainingPulses()
  }

  function release() {
    enterPretraining()
    stopActivePulses()
    secondContext?.destroy?.()
    startingBoundaryContext?.destroy?.()
    finalBoundaryContext?.destroy?.()
    secondContext = undefined
    startingBoundaryContext = undefined
    finalBoundaryContext = undefined
  }

  return {
    preload: ensureContexts,
    play(track: TrainingSoundscapeTrack, durationSeconds = 0) {
      if (track === 'formal') startFormal(durationSeconds)
      else {
        ensureContexts()
        enterPretraining()
      }
    },
    suspend() {
      if (!formalActive || suspended) return
      suspended = true
      suspendedAtMs = Date.now()
      clearPulseTimer()
    },
    resume() {
      if (!formalActive || !suspended) return
      const suspendedForMs = Math.max(0, Date.now() - suspendedAtMs)
      formalStartedAtMs += suspendedForMs
      lastPulseAtMs += suspendedForMs
      suspendedAtMs = 0
      suspended = false
      scheduleRemainingPulses()
    },
    stop: release
  }
}
