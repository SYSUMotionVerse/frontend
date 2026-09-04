import {
  createAnchoredTimelineScheduler,
  type AnchoredTimelineRuntime
} from './anchoredTimeline'

export type TrainingSoundscapeTrack = 'pretraining' | 'formal'
export type TrainingSoundEffect = 'second' | 'boundary'

export interface TrainingSoundEffectSlot {
  atMs: number
  second: number
  effect: TrainingSoundEffect | null
}

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
  onEnded?: (callback: () => void) => void
  onError?: (callback: (error: unknown) => void) => void
}

interface SoundscapeRuntime {
  createInnerAudioContext?: () => PulseAudioContextLike
}

export interface WebAudioBufferSourceLike {
  buffer?: unknown
  onended?: (() => void) | null
  connect: (destination: unknown) => void
  disconnect?: () => void
  start: (when?: number, offset?: number) => void
  stop: (when?: number) => void
}

interface WebAudioGainLike {
  gain: { value: number }
  connect: (destination: unknown) => void
  disconnect?: () => void
}

export interface TrainingWebAudioContextLike {
  currentTime: number
  destination: unknown
  createBufferSource: () => WebAudioBufferSourceLike
  createGain?: () => WebAudioGainLike
  decodeAudioData: (
    data: ArrayBuffer,
    success?: (buffer: unknown) => void,
    failure?: (error: unknown) => void
  ) => Promise<unknown> | void
  resume?: () => Promise<void> | void
  suspend?: () => Promise<void> | void
  close?: () => Promise<void> | void
  state?: string
}

/**
 * A context owner such as the training audio clock. The context may be
 * created lazily (inside the start gesture) and may be rebuilt after an
 * unrecoverable suspension, so it is fetched on every use.
 */
export interface SharedWebAudioContextSource {
  getContext: () => TrainingWebAudioContextLike | undefined
  isContextHealthy?: () => boolean
}

export interface TrainingWebAudioRuntime {
  createContext: () => TrainingWebAudioContextLike | undefined
  loadArrayBuffer: (url: string) => Promise<ArrayBuffer>
  ownsContext?: boolean
  /** Delegated health verdict; without it any present context is trusted. */
  isContextHealthy?: () => boolean
}

interface BinaryAudioPlatform {
  downloadFile?: (options: {
    url: string
    timeout?: number
    success?: (result: { tempFilePath: string; statusCode: number }) => void
    fail?: (error: unknown) => void
  }) => unknown
  request?: (options: {
    url: string
    responseType: 'arraybuffer'
    success?: (result: { data: ArrayBuffer; statusCode: number }) => void
    fail?: (error: unknown) => void
  }) => unknown
}

interface BinaryFileSystem {
  readFile?: (options: {
    filePath: string
    success?: (result: { data: ArrayBuffer }) => void
    fail?: (error: unknown) => void
  }) => unknown
}

type WechatSoundscapeFactory = typeof wx & SoundscapeRuntime & BinaryAudioPlatform & {
  createWebAudioContext?: () => TrainingWebAudioContextLike
  getFileSystemManager?: () => BinaryFileSystem
}

export function createDefaultTrainingWebAudioRuntime(
  sharedContext?: TrainingWebAudioContextLike | SharedWebAudioContextSource
): TrainingWebAudioRuntime | undefined {
  const wechatApi = typeof wx === 'undefined' ? null : wx as WechatSoundscapeFactory
  const uniApi = typeof uni === 'undefined' ? null : uni as unknown as BinaryAudioPlatform
  const contextSource: SharedWebAudioContextSource | undefined = sharedContext
    ? 'getContext' in sharedContext
      ? sharedContext
      : { getContext: () => sharedContext }
    : undefined
  let ownedContext: TrainingWebAudioContextLike | undefined
  if (!contextSource && !wechatApi?.createWebAudioContext) return undefined

  return {
    ownsContext: !contextSource,
    createContext: () => {
      if (contextSource) return contextSource.getContext()
      // Cache the owned context: callers re-check on every track start, and
      // each createWebAudioContext() call would otherwise leak one context.
      ownedContext ??= wechatApi?.createWebAudioContext?.()
      return ownedContext
    },
    isContextHealthy: contextSource?.isContextHealthy,
    loadArrayBuffer(url) {
      const downloadApi = uniApi?.downloadFile ? uniApi : wechatApi
      const fileSystem = wechatApi?.getFileSystemManager?.()
      if (downloadApi?.downloadFile && fileSystem?.readFile) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          downloadApi.downloadFile?.({
            url,
            timeout: 30_000,
            success(result) {
              if (result.statusCode < 200 || result.statusCode >= 300) {
                reject(new Error(`sound download returned ${result.statusCode}`))
                return
              }
              fileSystem.readFile?.({
                filePath: result.tempFilePath,
                success: (file: { data: ArrayBuffer }) => resolve(file.data),
                fail: reject
              })
            },
            fail: reject
          })
        })
      }

      if (wechatApi?.request) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          wechatApi?.request?.({
            url,
            responseType: 'arraybuffer',
            success(result: { data: ArrayBuffer; statusCode: number }) {
              if (result.statusCode >= 200 && result.statusCode < 300) resolve(result.data)
              else reject(new Error(`sound request returned ${result.statusCode}`))
            },
            fail: reject
          })
        })
      }
      return Promise.reject(new Error('binary audio loading is unavailable'))
    }
  }
}

/** Precompute every logical second, including intentionally silent seconds. */
export function buildTrainingSoundEffectTrack(
  track: TrainingSoundscapeTrack,
  durationSeconds: number
): TrainingSoundEffectSlot[] {
  const seconds = Math.max(0, Math.ceil(durationSeconds))
  return Array.from({ length: seconds }, (_, index) => {
    // Public action seconds are one-based: a 15-second action occupies
    // [1, 16), while its scheduling offset remains [0, 15).
    const second = index + 1
    // A shared boundary belongs exclusively to the following phase's first
    // second. The preceding phase must not schedule a second copy at its end.
    const isBoundary = second === 1
    const shouldPlaySecond = track === 'formal'
      || second >= Math.max(2, seconds - 2)
    return {
      atMs: index * 1000,
      second,
      effect: isBoundary
        ? 'boundary'
        : shouldPlaySecond
          ? 'second'
          : null
    }
  })
}

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
  },
  timelineRuntime?: AnchoredTimelineRuntime,
  webAudioRuntime: TrainingWebAudioRuntime | undefined | null = createDefaultTrainingWebAudioRuntime()
) {
  const secondContexts: Array<PulseAudioContextLike | undefined> = [undefined, undefined]
  let nextSecondContextIndex = 0
  let startingBoundaryContext: PulseAudioContextLike | undefined
  let finalBoundaryContext: PulseAudioContextLike | undefined
  let activePulseContext: PulseAudioContextLike | undefined
  const timeline = createAnchoredTimelineScheduler<TrainingSoundEffectSlot>(timelineRuntime)
  let activeTrack: TrainingSoundscapeTrack | null = null
  let suspended = false
  let endBoundaryPlayed = false
  let webAudioContext: TrainingWebAudioContextLike | undefined
  let secondBuffer: unknown
  let boundaryBuffer: unknown
  let soundAssetsPromise: Promise<{
    second: ArrayBuffer
    boundary: ArrayBuffer
  } | null> | undefined
  let decodedContext: TrainingWebAudioContextLike | undefined
  let decodePromise: Promise<boolean> | undefined
  let webAudioTrackActive = false
  const scheduledWebAudioSources = new Set<{
    source: WebAudioBufferSourceLike
    startsAt: number
  }>()

  function decodeAudioData(context: TrainingWebAudioContextLike, data: ArrayBuffer) {
    return new Promise<unknown>((resolve, reject) => {
      let settled = false
      const succeed = (buffer: unknown) => {
        if (settled) return
        settled = true
        resolve(buffer)
      }
      const fail = (error: unknown) => {
        if (settled) return
        settled = true
        reject(error)
      }
      try {
        const result = context.decodeAudioData(data, succeed, fail)
        if (result && typeof result.then === 'function') result.then(succeed, fail)
      } catch (error) {
        fail(error)
      }
    })
  }

  /** Network download only — safe to run before any user gesture. */
  function loadSoundAssets() {
    if (!webAudioRuntime) return Promise.resolve(null)
    soundAssetsPromise ??= (async () => {
      try {
        const [secondData, boundaryData] = await Promise.all([
          webAudioRuntime.loadArrayBuffer(trainingSecondSoundUrl),
          webAudioRuntime.loadArrayBuffer(trainingBoundarySoundUrl)
        ])
        return { second: secondData, boundary: boundaryData }
      } catch (error) {
        console.warn('[TrainingSoundscape] sound asset download failed, using native fallback:', error)
        return null
      }
    })()
    return soundAssetsPromise
  }

  /**
   * Decode against the runtime's current context. The shared clock context is
   * created lazily inside the start gesture and may be rebuilt after an
   * unrecoverable suspension, so decoding is retried whenever the context
   * identity changes and the cached raw bytes make each retry cheap.
   */
  function ensureDecodedBuffers(): Promise<boolean> {
    if (!webAudioRuntime) return Promise.resolve(false)
    const context = webAudioRuntime.createContext()
    if (!context) return Promise.resolve(false)
    if (decodePromise && decodedContext === context) return decodePromise
    decodedContext = context
    decodePromise = loadSoundAssets().then(async assets => {
      if (!assets) return false
      webAudioContext = context
      try {
        ;[secondBuffer, boundaryBuffer] = await Promise.all([
          decodeAudioData(context, assets.second),
          decodeAudioData(context, assets.boundary)
        ])
      } catch (error) {
        console.warn('[TrainingSoundscape] Web Audio decode failed, using native fallback:', error)
        return false
      }
      return Boolean(secondBuffer && boundaryBuffer)
    })
    return decodePromise
  }

  /**
   * Gate for the sample-clock track path: the context must be the healthy one
   * the clock vouches for, and its buffers must be decoded against it. A
   * suspended context would accept every scheduled source into a frozen
   * timeline — silence now, a simultaneous dump on resume — so an unhealthy
   * or freshly rebuilt context defers to the native branch while decoding
   * catches up.
   */
  function isWebAudioTrackReady() {
    if (!webAudioRuntime) return false
    if (webAudioRuntime.isContextHealthy && !webAudioRuntime.isContextHealthy()) return false
    const context = webAudioRuntime.createContext()
    if (!context) return false
    if (context !== webAudioContext) {
      void ensureDecodedBuffers()
      return false
    }
    return Boolean(secondBuffer && boundaryBuffer)
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
    context.onEnded?.(() => {
      // Native playback has already finished. Clearing this reference avoids
      // calling stop() on an idle player immediately before the next beat.
      if (activePulseContext === context) activePulseContext = undefined
    })
    context.onError?.(error => {
      console.warn('[TrainingSoundscape] playback failed:', error)
    })
    return context
  }

  function ensureContexts() {
    for (let index = 0; index < secondContexts.length; index += 1) {
      secondContexts[index] ??= createPulseContext(
        trainingSecondSoundUrl,
        trainingSoundscapeVolumes.second
      )
    }
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
    for (const context of secondContexts) context?.stop?.()
    startingBoundaryContext?.stop?.()
    finalBoundaryContext?.stop?.()
    activePulseContext = undefined
  }

  function playPulse(context: PulseAudioContextLike | undefined) {
    if (!context) return
    try {
      // Never let the longer boundary cue overlap the following whole-second
      // cue. Only stop the context that actually played the preceding pulse.
      // Stopping an idle preloaded context can leave WeChat's native player in
      // a pending state and make its first play() call one second later vanish.
      if (activePulseContext && activePulseContext !== context) {
        activePulseContext.stop?.()
      }
      activePulseContext = context
      context.play?.()
    } catch (error) {
      console.warn('[TrainingSoundscape] playback setup failed:', error)
    }
  }

  function playSecondPulse() {
    const context = secondContexts[nextSecondContextIndex]
    nextSecondContextIndex = (nextSecondContextIndex + 1) % secondContexts.length
    // WeChat can ignore play() when the same InnerAudioContext has not yet
    // completed its previous native state transition. Alternating two
    // preloaded contexts ensures the selected player was stopped on the
    // preceding beat and is ready before this beat arrives.
    playPulse(context)
  }

  function stopWebAudioSources(includeActive = true) {
    if (!webAudioContext) return
    const now = webAudioContext.currentTime
    for (const scheduled of [...scheduledWebAudioSources]) {
      if (!includeActive && scheduled.startsAt <= now + 0.001) continue
      try {
        scheduled.source.stop(now)
      } catch {
        // A source may already have ended naturally.
      }
      scheduled.source.disconnect?.()
      scheduledWebAudioSources.delete(scheduled)
    }
  }

  function scheduleWebAudioPulse(effect: TrainingSoundEffect, startsAt: number) {
    if (!webAudioContext) return
    const buffer = effect === 'second' ? secondBuffer : boundaryBuffer
    if (!buffer) return
    const source = webAudioContext.createBufferSource()
    source.buffer = buffer
    const gain = webAudioContext.createGain?.()
    if (gain) {
      gain.gain.value = effect === 'second'
        ? trainingSoundscapeVolumes.second
        : trainingSoundscapeVolumes.boundary
      source.connect(gain)
      gain.connect(webAudioContext.destination)
    } else {
      source.connect(webAudioContext.destination)
    }
    const scheduled = { source, startsAt }
    scheduledWebAudioSources.add(scheduled)
    source.onended = () => {
      scheduledWebAudioSources.delete(scheduled)
      source.disconnect?.()
      gain?.disconnect?.()
    }
    source.start(startsAt)
  }

  function scheduleWebAudioTrack(
    slots: readonly TrainingSoundEffectSlot[],
    elapsedSeconds: number
  ) {
    if (!webAudioContext || !secondBuffer || !boundaryBuffer) return false
    stopWebAudioSources()
    const now = webAudioContext.currentTime
    const origin = now - elapsedSeconds
    const audibleSlots = slots.filter(slot => (
      slot.effect && slot.atMs / 1000 + 0.001 >= elapsedSeconds
    )) as Array<TrainingSoundEffectSlot & { effect: TrainingSoundEffect }>
    audibleSlots.forEach(slot => {
      const startsAt = Math.max(now, origin + slot.atMs / 1000)
      // Let every one-shot buffer end naturally. On WeChat, calling stop()
      // immediately after start(futureTime) can end the source before its
      // scheduled start. That left only the already-started first cue and the
      // final cue (which had no following stop) audible on real devices.
      scheduleWebAudioPulse(slot.effect, startsAt)
    })
    webAudioTrackActive = true
    return true
  }

  function resetTrackState() {
    activeTrack = null
    suspended = false
    endBoundaryPlayed = false
    nextSecondContextIndex = 0
    timeline.stop()
  }

  function stopPlayback() {
    stopActivePulses()
    stopWebAudioSources()
    webAudioTrackActive = false
    resetTrackState()
  }

  function finishTrack(playFinalBoundary = false) {
    // Cancel only future scheduling. An end-boundary sound that has just
    // reached the native player must be allowed to finish across the phase
    // hand-off.
    if (webAudioTrackActive) stopWebAudioSources(false)
    if (activeTrack && playFinalBoundary && !endBoundaryPlayed) {
      endBoundaryPlayed = true
      if (webAudioTrackActive && webAudioContext && boundaryBuffer) {
        stopWebAudioSources()
        scheduleWebAudioPulse('boundary', webAudioContext.currentTime)
      } else {
        playPulse(finalBoundaryContext)
      }
    }
    timeline.stop()
    activeTrack = null
    suspended = false
    webAudioTrackActive = false
  }

  function startTrack(
    track: TrainingSoundscapeTrack,
    durationSeconds: number,
    elapsedSeconds = 0
  ) {
    // Keep the preloaded player that is about to emit out of an asynchronous
    // stop/play race. `playPulse` stops only the other tracks at the boundary.
    resetTrackState()
    activeTrack = track
    endBoundaryPlayed = false
    const slots = buildTrainingSoundEffectTrack(track, durationSeconds)
    if (isWebAudioTrackReady() && scheduleWebAudioTrack(slots, Math.max(0, elapsedSeconds))) return
    ensureContexts()
    timeline.start(
      slots.map(slot => ({ atMs: slot.atMs, value: slot })),
      slot => {
        // The scheduler deliberately visits silent slots too: the rule is
        // evaluated exactly once for every logical second.
        if (slot.effect === 'second') playSecondPulse()
        if (slot.effect === 'boundary') {
          playPulse(startingBoundaryContext)
        }
      },
      { elapsedMs: Math.max(0, elapsedSeconds) * 1000 }
    )
  }

  function release() {
    stopPlayback()
    for (const context of secondContexts) context?.destroy?.()
    startingBoundaryContext?.destroy?.()
    finalBoundaryContext?.destroy?.()
    secondContexts.fill(undefined)
    startingBoundaryContext = undefined
    finalBoundaryContext = undefined
    if (webAudioRuntime?.ownsContext !== false) void webAudioContext?.close?.()
    webAudioContext = undefined
    secondBuffer = undefined
    boundaryBuffer = undefined
    decodedContext = undefined
    decodePromise = undefined
  }

  return {
    /**
     * Download the effect assets, and decode them as soon as a context is
     * available. Call once at session setup (download only, before any user
     * gesture) and again after the clock's in-gesture `ensureContext()` so
     * the buffers are decoded against the real context before the first
     * phase starts.
     */
    preload() {
      if (!webAudioRuntime) {
        ensureContexts()
        return Promise.resolve()
      }
      return ensureDecodedBuffers().then(ready => {
        if (!ready) {
          // The shared context is not usable yet (pre-gesture, decode still
          // running, or decode failed): warm the native standby players so a
          // fallback track never has to create a player and play it in the
          // same tick — WeChat drops that first play on real devices.
          ensureContexts()
        }
      })
    },
    play(track: TrainingSoundscapeTrack, durationSeconds = 0, elapsedSeconds = 0) {
      if (durationSeconds > 0) startTrack(track, durationSeconds, elapsedSeconds)
      else stopPlayback()
    },
    suspend() {
      if (!activeTrack || suspended) return
      suspended = true
      if (webAudioTrackActive) void webAudioContext?.suspend?.()
      else timeline.suspend()
    },
    resume() {
      if (!activeTrack || !suspended) return
      suspended = false
      if (webAudioTrackActive) void webAudioContext?.resume?.()
      else timeline.resume()
    },
    finish: finishTrack,
    stop: stopPlayback,
    destroy: release
  }
}
