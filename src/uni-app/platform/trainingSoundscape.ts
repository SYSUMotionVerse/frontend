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
  let trackStartedAtMs = 0
  let suspendedAtMs = 0
  let activeTrack: TrainingSoundscapeTrack | null = null
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
    if (!activeTrack || suspended || nextPulseIndex >= totalPulses) {
      clearPulseTimer()
      return
    }

    if (activeTrack === 'formal') {
      const isFirst = nextPulseIndex === 0
      const isFinal = nextPulseIndex === totalPulses - 1
      playPulse(
        isFirst
          ? startingBoundaryContext
          : isFinal
            ? finalBoundaryContext
            : secondContext
      )
    } else if (nextPulseIndex >= Math.max(0, totalPulses - 3)) {
      playPulse(secondContext)
    }
    nextPulseIndex += 1
    if (nextPulseIndex >= totalPulses) clearPulseTimer()
  }

  function scheduleRemainingPulses() {
    clearPulseTimer()
    if (!activeTrack || suspended || nextPulseIndex >= totalPulses) return
    // Every event is anchored to one immutable phase clock. Never derive the
    // next beat from the previous callback: native timer/audio latency would
    // otherwise accumulate and make a nominal 60 BPM cue audibly drift.
    const now = Date.now()
    const elapsedWholeSeconds = Math.max(0, Math.floor((now - trackStartedAtMs) / 1000))
    if (elapsedWholeSeconds > nextPulseIndex) {
      // When the JS thread was suspended, skip stale beats instead of firing a
      // rapid catch-up burst. The current logical second remains exact.
      nextPulseIndex = Math.min(elapsedWholeSeconds, totalPulses - 1)
    }
    const anchoredAt = trackStartedAtMs + nextPulseIndex * 1000
    const delay = Math.max(0, anchoredAt - now)
    pulseTimer = setTimeout(() => {
      pulseTimer = null
      emitNextPulse()
      scheduleRemainingPulses()
    }, delay)
  }

  function resetTrackState() {
    activeTrack = null
    suspended = false
    totalPulses = 0
    nextPulseIndex = 0
    trackStartedAtMs = 0
    suspendedAtMs = 0
    clearPulseTimer()
  }

  function stopPlayback() {
    stopActivePulses()
    resetTrackState()
  }

  function startTrack(track: TrainingSoundscapeTrack, durationSeconds: number) {
    // Keep the preloaded player that is about to emit out of an asynchronous
    // stop/play race. `playPulse` stops only the other tracks at the boundary.
    resetTrackState()
    ensureContexts()
    activeTrack = track
    totalPulses = Math.max(1, Math.ceil(durationSeconds))
    trackStartedAtMs = Date.now()
    // Formal N-second phases emit at t=0..N-1. Pretraining uses the same
    // independent clock but stays silent until its final three seconds.
    emitNextPulse()
    scheduleRemainingPulses()
  }

  function release() {
    stopPlayback()
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
      if (durationSeconds > 0) startTrack(track, durationSeconds)
      else stopPlayback()
    },
    suspend() {
      if (!activeTrack || suspended) return
      suspended = true
      suspendedAtMs = Date.now()
      clearPulseTimer()
    },
    resume() {
      if (!activeTrack || !suspended) return
      const suspendedForMs = Math.max(0, Date.now() - suspendedAtMs)
      trackStartedAtMs += suspendedForMs
      suspendedAtMs = 0
      suspended = false
      scheduleRemainingPulses()
    },
    stop: stopPlayback,
    destroy: release
  }
}
