import type { ActionTtsCue } from '../../domain/training/actionScoringTypes'
import {
  createAnchoredTimelineScheduler,
  type AnchoredTimelineRuntime
} from './anchoredTimeline'
import type {
  TrainingWebAudioContextLike,
  TrainingWebAudioRuntime,
  WebAudioBufferSourceLike
} from './trainingSoundscape'

interface InnerAudioContextLike {
  src: string
  autoplay: boolean
  obeyMuteSwitch?: boolean
  playbackRate?: number
  play?: () => void
  pause?: () => void
  stop?: () => void
  destroy?: () => void
  onEnded?: (callback: () => void) => void
  onError?: (callback: (error: unknown) => void) => void
}

interface AudioDownloadPlatform {
  downloadFile?: (options: {
    url: string
    timeout?: number
    success?: (result: { tempFilePath: string; statusCode: number }) => void
    fail?: (error?: unknown) => void
  }) => unknown
}

interface AudioRuntime extends AudioDownloadPlatform {
  createInnerAudioContext?: () => InnerAudioContextLike
}

interface InnerAudioOptionPlatform {
  setInnerAudioOption?: (options: {
    obeyMuteSwitch: boolean
    mixWithOther: boolean
    fail?: (error: unknown) => void
  }) => unknown
}

type WechatAudioFactory = typeof wx & {
  createInnerAudioContext?: () => InnerAudioContextLike
} & InnerAudioOptionPlatform

const audioDownloadTimeoutMs = 30_000
const audioPreloadConcurrency = 4
// The server-generated assets already use the configured voice and speech rate.
// Keep native playback at 1x so the database
// timing plan can be checked against the actual MP3 duration without an
// invisible 12% slowdown that truncates cues at phase boundaries.
export const trainingTtsPlaybackRate = 1
export const trainingTtsPlaybackTimeoutMs = 45_000
// Fetch+decode budget per cue before the native player takes over.
const webAudioCueTimeoutMs = 12_000
// Decoded PCM is roughly 10x the compressed asset, so cap the resident set
// and evict least-recently-used cues; evicted cues re-decode from the cached
// compressed bytes in well under a second.
const maxDecodedCueBytes = 20 * 1024 * 1024
const maxRawCueBytes = 6 * 1024 * 1024

/** Configure the native output route from a foreground user interaction. */
export function configureTrainingAudioOutput() {
  const wechatApi = typeof wx === 'undefined' ? null : wx as WechatAudioFactory
  const uniApi = typeof uni === 'undefined'
    ? null
    : uni as unknown as InnerAudioOptionPlatform
  const audioPlatform = wechatApi?.setInnerAudioOption ? wechatApi : uniApi
  try {
    audioPlatform?.setInnerAudioOption?.({
      obeyMuteSwitch: false,
      mixWithOther: false,
      fail(error) {
        console.warn('[TrainingTts] unable to configure native audio output:', error)
      }
    })
  } catch (error) {
    console.warn('[TrainingTts] unable to configure native audio output:', error)
  }
}

function normalizeCues(cues: readonly ActionTtsCue[]) {
  return cues
    .filter(cue =>
      Number.isFinite(cue.time)
      && cue.time >= 0
      && cue.audio_url.trim().length > 0
    )
    .slice()
    .sort((left, right) => left.time - right.time)
}

function decodeWebAudioData(context: TrainingWebAudioContextLike, data: ArrayBuffer) {
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
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(succeed, fail)
      }
    } catch (error) {
      fail(error)
    }
  })
}

interface WebCueBuffer {
  context: TrainingWebAudioContextLike
  buffer: unknown
}

export function createTrainingTtsPlayer(
  createAudioContext = () => {
    const wechatApi = typeof wx === 'undefined' ? null : wx as WechatAudioFactory
    const wechatContext = wechatApi?.createInnerAudioContext?.()
    if (wechatContext) return wechatContext

    // The uni-app mp-weixin bundle exposes some wx APIs through its runtime
    // proxy rather than the enumerable wx snapshot. Use that proxy as a
    // fallback so TTS still works in DevTools and on older base libraries.
    const uniApi = typeof uni === 'undefined' ? null : uni as unknown as AudioRuntime
    return uniApi?.createInnerAudioContext?.()
  },
  downloadPlatform = (
    typeof uni === 'undefined'
      ? null
      : uni as unknown as AudioDownloadPlatform
  ),
  timelineRuntime?: AnchoredTimelineRuntime,
  webAudioRuntime?: TrainingWebAudioRuntime | null
) {
  let audioContext: InnerAudioContextLike | undefined
  let stopCurrentPlayback: (() => void) | undefined
  let playedCueIndexes = new Set<number>()
  let suspended = false
  let queuedAudioUrls: Array<{
    url: string
    resolve: () => void
  }> = []
  let idleWaiters: Array<() => void> = []
  let playbackGeneration = 0
  const preloadedSources = new Map<string, string>()
  const pendingPreloads = new Map<string, Promise<void>>()
  const timeline = createAnchoredTimelineScheduler<ActionTtsCue>(timelineRuntime)

  // --- Web Audio cue backend ---------------------------------------------
  // Speech rides the same shared context as the sound effects so both mix in
  // one audio session instead of fighting for the native audio focus. Every
  // cue keeps the InnerAudio player as a per-cue fallback.

  interface ActiveWebCue {
    url: string
    context: TrainingWebAudioContextLike
    buffer: unknown
    source: WebAudioBufferSourceLike
    startedAtAudioSec: number
    onComplete?: () => void
    settle: (complete: boolean) => void
  }

  let activeWebCue: ActiveWebCue | undefined
  let pausedWebCue: {
    url: string
    onComplete?: () => void
    offsetSec: number
  } | undefined
  let decodedForContext: TrainingWebAudioContextLike | undefined
  let decodedCueBytesTotal = 0
  let rawCueBytesTotal = 0
  const decodedCueBuffers = new Map<string, WebCueBuffer & { bytes: number }>()
  const rawCueBytes = new Map<string, ArrayBuffer>()
  const pendingCueDecodes = new Map<string, Promise<WebCueBuffer | null>>()

  function usableWebAudioContext() {
    if (!webAudioRuntime) return undefined
    if (webAudioRuntime.isContextHealthy && !webAudioRuntime.isContextHealthy()) return undefined
    return webAudioRuntime.createContext() ?? undefined
  }

  function rememberRawCueBytes(url: string, bytes: ArrayBuffer) {
    if (rawCueBytes.has(url)) return
    rawCueBytes.set(url, bytes)
    rawCueBytesTotal += bytes.byteLength
    while (rawCueBytesTotal > maxRawCueBytes && rawCueBytes.size > 1) {
      const oldestKey = rawCueBytes.keys().next().value as string | undefined
      if (oldestKey === undefined) break
      rawCueBytesTotal -= rawCueBytes.get(oldestKey)?.byteLength ?? 0
      rawCueBytes.delete(oldestKey)
    }
  }

  function rememberDecodedCue(url: string, entry: WebCueBuffer & { bytes: number }) {
    const existing = decodedCueBuffers.get(url)
    if (existing) decodedCueBytesTotal -= existing.bytes
    // Map iteration order is insertion order, so re-inserting moves this cue
    // to the back of the eviction queue.
    decodedCueBuffers.delete(url)
    decodedCueBuffers.set(url, entry)
    decodedCueBytesTotal += entry.bytes
    while (decodedCueBytesTotal > maxDecodedCueBytes && decodedCueBuffers.size > 1) {
      const oldestKey = decodedCueBuffers.keys().next().value as string | undefined
      if (oldestKey === undefined) break
      decodedCueBytesTotal -= decodedCueBuffers.get(oldestKey)?.bytes ?? 0
      decodedCueBuffers.delete(oldestKey)
    }
  }

  function raceWithTimeout<T>(job: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[TrainingTts] ${label} timed out`))
      }, webAudioCueTimeoutMs)
      job.then(
        value => {
          clearTimeout(timer)
          resolve(value)
        },
        error => {
          clearTimeout(timer)
          reject(error)
        }
      )
    })
  }

  function ensureWebCueBuffer(url: string): Promise<WebCueBuffer | null> {
    const context = usableWebAudioContext()
    if (!context || !webAudioRuntime) return Promise.resolve(null)
    if (decodedForContext !== context) {
      // The shared context was (re)created. Decoded buffers cannot be assumed
      // to survive a close(), but the cached compressed bytes make re-decoding
      // cheap and network-free.
      decodedCueBuffers.clear()
      decodedCueBytesTotal = 0
      decodedForContext = context
    }
    const cached = decodedCueBuffers.get(url)
    if (cached) {
      rememberDecodedCue(url, cached)
      return Promise.resolve({ context: cached.context, buffer: cached.buffer })
    }
    const pending = pendingCueDecodes.get(url)
    if (pending) return pending
    const job = (async () => {
      try {
        let bytes = rawCueBytes.get(url)
        if (!bytes) {
          bytes = await raceWithTimeout(
            Promise.resolve(webAudioRuntime.loadArrayBuffer(url)),
            'cue download'
          )
          rememberRawCueBytes(url, bytes)
        }
        const buffer = await raceWithTimeout(
          decodeWebAudioData(context, bytes),
          'cue decode'
        )
        if (!buffer || decodedForContext !== context) return null
        // PCM residency estimate: compressed size times ~10x.
        const entry = { context, buffer, bytes: bytes.byteLength * 10 }
        rememberDecodedCue(url, entry)
        return { context, buffer }
      } catch (error) {
        console.warn('[TrainingTts] web audio cue unavailable, using native fallback:', url, error)
        return null
      } finally {
        pendingCueDecodes.delete(url)
      }
    })()
    pendingCueDecodes.set(url, job)
    return job
  }

  function resolveIdleWaiters() {
    if (
      audioContext
      || activeWebCue
      || queuedAudioUrls.length > 0
      || suspended
      || timeline.isRunning()
    ) return
    const waiters = idleWaiters
    idleWaiters = []
    waiters.forEach(resolve => resolve())
  }

  function waitForIdle() {
    if (
      !audioContext
      && !activeWebCue
      && queuedAudioUrls.length === 0
      && !suspended
      && !timeline.isRunning()
    ) {
      return Promise.resolve()
    }
    return new Promise<void>(resolve => idleWaiters.push(resolve))
  }

  function preloadAudioUrl(audioUrl: string) {
    const normalizedUrl = audioUrl.trim()
    if (
      !normalizedUrl
      || preloadedSources.has(normalizedUrl)
      || !downloadPlatform?.downloadFile
    ) {
      return Promise.resolve()
    }

    const existing = pendingPreloads.get(normalizedUrl)
    if (existing) return existing

    const pending = new Promise<void>(resolve => {
      downloadPlatform.downloadFile?.({
        url: normalizedUrl,
        timeout: audioDownloadTimeoutMs,
        success(result) {
          if (
            result.statusCode >= 200
            && result.statusCode < 300
            && result.tempFilePath.trim().length > 0
          ) {
            preloadedSources.set(normalizedUrl, result.tempFilePath)
          } else {
            console.warn(
              '[TrainingTts] preload rejected:',
              normalizedUrl,
              result.statusCode
            )
          }
          resolve()
        },
        fail(error) {
          console.warn('[TrainingTts] preload failed:', normalizedUrl, error)
          resolve()
        }
      })
    }).finally(() => {
      pendingPreloads.delete(normalizedUrl)
    })
    pendingPreloads.set(normalizedUrl, pending)
    return pending
  }

  async function preloadAudioUrls(audioUrls: readonly string[]) {
    const urls = [...new Set(audioUrls.map(url => url.trim()).filter(Boolean))]
    let nextIndex = 0
    const preloadNext = async () => {
      while (nextIndex < urls.length) {
        const url = urls[nextIndex]
        nextIndex += 1
        await preloadAudioUrl(url)
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(audioPreloadConcurrency, urls.length) },
        preloadNext
      )
    )
  }

  function stopActiveWebCue() {
    const cue = activeWebCue
    if (!cue) return
    activeWebCue = undefined
    // An outside stop completes the cue exactly like the native player does:
    // its promise resolves and the queue moves on.
    cue.settle(true)
  }

  function stopAudio() {
    stopCurrentPlayback?.()
    stopActiveWebCue()
  }

  function startWebCue(
    cue: WebCueBuffer,
    audioUrl: string,
    onComplete: (() => void) | undefined,
    expectedGeneration: number,
    offsetSec: number
  ) {
    stopAudio()
    const source = cue.context.createBufferSource()
    source.buffer = cue.buffer
    source.connect(cue.context.destination)
    let settled = false
    let playbackTimeout: ReturnType<typeof setTimeout> | undefined
    const settle = (complete: boolean) => {
      if (settled) return
      settled = true
      if (playbackTimeout) clearTimeout(playbackTimeout)
      if (activeWebCue?.source === source) activeWebCue = undefined
      try {
        source.disconnect?.()
      } catch {
        // The context may already be gone.
      }
      if (complete) onComplete?.()
      resolveIdleWaiters()
    }
    // WeChat's stop() also delivers onended; settle() is idempotent, so an
    // intentional stop wins over the late ended event.
    source.onended = () => settle(true)
    playbackTimeout = setTimeout(() => {
      console.warn('[TrainingTts] web audio playback timed out:', audioUrl)
      settle(true)
      try {
        source.stop()
      } catch {
        // Already stopped with the context.
      }
    }, trainingTtsPlaybackTimeoutMs)
    activeWebCue = {
      url: audioUrl,
      context: cue.context,
      buffer: cue.buffer,
      source,
      startedAtAudioSec: cue.context.currentTime - offsetSec,
      onComplete,
      settle
    }
    try {
      if (offsetSec > 0) source.start(cue.context.currentTime, offsetSec)
      else source.start(cue.context.currentTime)
    } catch (error) {
      console.warn('[TrainingTts] web audio playback failed:', audioUrl, error)
      settle(false)
      void playAudioViaInnerAudio(audioUrl, onComplete, true, expectedGeneration)
    }
  }

  function tryPlayViaWebAudio(
    audioUrl: string,
    onComplete: (() => void) | undefined,
    expectedGeneration: number,
    offsetSec = 0
  ): Promise<void> | null {
    if (!webAudioRuntime || suspended) return null
    if (!usableWebAudioContext()) return null
    return (async () => {
      const cue = await ensureWebCueBuffer(audioUrl)
      if (!cue) {
        await playAudioViaInnerAudio(audioUrl, onComplete, true, expectedGeneration)
        return
      }
      if (suspended || expectedGeneration !== playbackGeneration) {
        onComplete?.()
        resolveIdleWaiters()
        return
      }
      startWebCue(cue, audioUrl, onComplete, expectedGeneration, offsetSec)
    })()
  }

  function pauseActiveWebCue() {
    const cue = activeWebCue
    if (!cue) return
    activeWebCue = undefined
    const offsetSec = Math.max(0, cue.context.currentTime - cue.startedAtAudioSec)
    pausedWebCue = { url: cue.url, onComplete: cue.onComplete, offsetSec }
    // Settle first so the ended event fired by stop() cannot complete the
    // paused cue; neither settle completes nor rejects it — the cue
    // continues after resume.
    cue.settle(false)
    try {
      cue.source.stop()
    } catch {
      // Already stopped with the context.
    }
  }

  function resumePausedWebCue() {
    const paused = pausedWebCue
    if (!paused) return
    pausedWebCue = undefined
    void tryPlayViaWebAudio(paused.url, paused.onComplete, playbackGeneration, paused.offsetSec)
      ?.then(() => undefined)
  }

  function playAudioViaInnerAudio(
    audioUrl: string,
    onComplete?: () => void,
    allowPreloadedSource = true,
    expectedGeneration = playbackGeneration
  ): Promise<void> {
    const normalizedUrl = audioUrl.trim()
    const pendingPreload = allowPreloadedSource
      ? pendingPreloads.get(normalizedUrl)
      : undefined
    if (pendingPreload) {
      return pendingPreload.then(() => {
        if (expectedGeneration !== playbackGeneration) {
          onComplete?.()
          return Promise.resolve()
        }
        return playAudioViaInnerAudio(
          normalizedUrl,
          onComplete,
          allowPreloadedSource,
          expectedGeneration
        )
      })
    }

    return new Promise<void>(resolve => {
      stopAudio()
      let nextAudioContext: InnerAudioContextLike | undefined
      try {
        nextAudioContext = createAudioContext()
      } catch (error) {
        console.warn('[TrainingTts] audio context unavailable:', error)
      }
      if (!nextAudioContext) {
        console.warn('[TrainingTts] unable to create an audio context')
        onComplete?.()
        resolve()
        return
      }

      let settled = false
      let playbackTimeout: ReturnType<typeof setTimeout> | undefined
      audioContext = nextAudioContext
      const sourceUrl = allowPreloadedSource
        ? preloadedSources.get(normalizedUrl) ?? normalizedUrl
        : normalizedUrl
      const dispose = (stopFirst = false, complete = true) => {
        if (settled) return
        settled = true
        if (playbackTimeout) clearTimeout(playbackTimeout)
        if (audioContext === nextAudioContext) {
          audioContext = undefined
          // A native end/error/timeout is terminal even if the context had
          // previously been suspended. Leaving this true makes waitForIdle()
          // wait forever and can lock the workout at an action boundary.
          suspended = false
        }
        if (stopCurrentPlayback === stopPlayback) stopCurrentPlayback = undefined
        if (stopFirst) nextAudioContext.stop?.()
        nextAudioContext.destroy?.()
        if (complete) {
          onComplete?.()
          resolve()
        }
      }
      const stopPlayback = () => dispose(true)
      stopCurrentPlayback = stopPlayback
      const retryWithRemoteSource = () => {
        if (suspended || sourceUrl === normalizedUrl || !allowPreloadedSource) return false
        if (preloadedSources.get(normalizedUrl) === sourceUrl) {
          preloadedSources.delete(normalizedUrl)
        }
        dispose(true, false)
        void playAudioViaInnerAudio(normalizedUrl, onComplete, false, expectedGeneration).then(resolve)
        return true
      }

      try {
        nextAudioContext.autoplay = false
        nextAudioContext.obeyMuteSwitch = false
        nextAudioContext.playbackRate = trainingTtsPlaybackRate
        nextAudioContext.src = sourceUrl
        nextAudioContext.onEnded?.(() => dispose())
        nextAudioContext.onError?.(error => {
          console.warn('[TrainingTts] playback failed:', error)
          if (!retryWithRemoteSource()) dispose()
        })
        playbackTimeout = setTimeout(() => {
          console.warn('[TrainingTts] playback timed out:', normalizedUrl)
          dispose(true)
        }, trainingTtsPlaybackTimeoutMs)
        nextAudioContext.play?.()
      } catch (error) {
        console.warn('[TrainingTts] playback setup failed:', error)
        if (!retryWithRemoteSource()) dispose()
      }
    })
  }

  function playAudioUrl(
    audioUrl: string,
    onComplete?: () => void,
    allowPreloadedSource = true,
    expectedGeneration = playbackGeneration
  ): Promise<void> {
    const normalizedUrl = audioUrl.trim()
    if (!normalizedUrl || suspended) {
      onComplete?.()
      return Promise.resolve()
    }

    const pendingPreload = allowPreloadedSource
      ? pendingPreloads.get(normalizedUrl)
      : undefined
    if (pendingPreload) {
      return pendingPreload.then(() => {
        if (expectedGeneration !== playbackGeneration) {
          onComplete?.()
          return Promise.resolve()
        }
        return playAudioUrl(normalizedUrl, onComplete, allowPreloadedSource, expectedGeneration)
      })
    }

    if (webAudioRuntime) {
      return tryPlayViaWebAudio(normalizedUrl, onComplete, expectedGeneration)
        ?? playAudioViaInnerAudio(normalizedUrl, onComplete, allowPreloadedSource, expectedGeneration)
    }
    return playAudioViaInnerAudio(normalizedUrl, onComplete, allowPreloadedSource, expectedGeneration)
  }

  function enqueueAudioUrls(audioUrls: readonly string[]) {
    const pending = audioUrls
      .map(url => url.trim())
      .filter(Boolean)
      .map(url => new Promise<void>(resolve => {
        queuedAudioUrls.push({ url, resolve })
      }))
    playNextQueuedAudio()
    return Promise.all(pending).then(() => undefined)
  }

  function playNextQueuedAudio() {
    if (audioContext || activeWebCue || suspended) return
    const nextAudio = queuedAudioUrls.shift()
    if (!nextAudio) {
      resolveIdleWaiters()
      return
    }
    void playAudioUrl(nextAudio.url, () => {
      nextAudio.resolve()
      playNextQueuedAudio()
    })
  }

  function clearQueuedAudio() {
    const queued = queuedAudioUrls
    queuedAudioUrls = []
    queued.forEach(item => item.resolve())
    resolveIdleWaiters()
  }

  return {
    reset() {
      playbackGeneration += 1
      suspended = false
      timeline.stop()
      clearQueuedAudio()
      stopAudio()
      playedCueIndexes = new Set()
    },
    resetTimeline(options: { interrupt?: boolean } = {}) {
      timeline.stop()
      if (options.interrupt) {
        playbackGeneration += 1
        suspended = false
        clearQueuedAudio()
        stopAudio()
      }
      playedCueIndexes = new Set()
    },
    // Move into an adjacent training module without cutting off a cue that
    // has already reached the native audio player. Any still-queued cue is
    // stale once its source module ends, so discard it before the next
    // module enqueues its own start guidance.
    advanceTimeline() {
      playbackGeneration += 1
      timeline.stop()
      clearQueuedAudio()
      playedCueIndexes = new Set()
    },
    // Keep a cue that has already reached the native audio player, but cancel
    // anything still waiting for a COS preload (or queued behind it). This is
    // used at a countdown boundary so a slow download cannot speak after the
    // visible 3/2/1 overlay has gone away.
    cancelPendingPlayback() {
      playbackGeneration += 1
      timeline.stop()
      clearQueuedAudio()
    },
    schedule(cues: readonly ActionTtsCue[], elapsedSeconds = 0) {
      playedCueIndexes = new Set()
      const normalized = normalizeCues(cues)
      timeline.start(
        normalized.map(cue => ({ atMs: cue.time * 1000, value: cue })),
        cue => {
          enqueueAudioUrls([cue.audio_url])
        },
        {
          elapsedMs: Math.max(0, elapsedSeconds) * 1000,
          onComplete: resolveIdleWaiters
        }
      )
    },
    sync(cues: readonly ActionTtsCue[], elapsedSeconds: number) {
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return
      const normalized = normalizeCues(cues)
      const dueCueIndexes = normalized
        .map((cue, index) => ({ cue, index }))
        .filter(({ cue, index }) => (
          cue.time <= elapsedSeconds && !playedCueIndexes.has(index)
        ))
      if (dueCueIndexes.length === 0) return

      dueCueIndexes.forEach(({ index }) => playedCueIndexes.add(index))
      enqueueAudioUrls(dueCueIndexes.map(({ cue }) => cue.audio_url))
    },
    playUrl(audioUrl: string) {
      playbackGeneration += 1
      clearQueuedAudio()
      return playAudioUrl(audioUrl, playNextQueuedAudio, true, playbackGeneration)
    },
    enqueue(audioUrls: readonly string[]) {
      return enqueueAudioUrls(audioUrls)
    },
    replace(audioUrls: readonly string[]) {
      playbackGeneration += 1
      clearQueuedAudio()
      stopAudio()
      return enqueueAudioUrls(audioUrls)
    },
    preload(audioUrls: readonly string[]) {
      const urls = [...new Set(audioUrls.map(url => url.trim()).filter(Boolean))]
      // With the web audio backend enabled, one CDN fetch feeds the decoded
      // cache and the native fallback plays the remote URL directly, so the
      // temp-file download would only double the bytes.
      if (webAudioRuntime) {
        return Promise.all(urls.map(url => ensureWebCueBuffer(url)))
          .then(() => undefined)
      }
      return preloadAudioUrls(urls)
    },
    waitForIdle,
    pause() {
      playbackGeneration += 1
      suspended = false
      timeline.stop()
      clearQueuedAudio()
      stopAudio()
    },
    suspend() {
      if (suspended) return
      // A download can resolve after the mini-program has entered the
      // background. Invalidate that continuation so it cannot invoke the
      // forbidden native operateAudio JSAPI before onShow resumes the session.
      playbackGeneration += 1
      suspended = true
      timeline.suspend()
      audioContext?.pause?.()
      pauseActiveWebCue()
    },
    resume() {
      if (!suspended) return
      suspended = false
      timeline.resume()
      if (audioContext) {
        audioContext.play?.()
      } else if (pausedWebCue) {
        resumePausedWebCue()
      } else {
        playNextQueuedAudio()
      }
    },
    destroy() {
      playbackGeneration += 1
      suspended = false
      timeline.stop()
      clearQueuedAudio()
      stopAudio()
      playedCueIndexes = new Set()
      pausedWebCue = undefined
      decodedCueBuffers.clear()
      decodedCueBytesTotal = 0
      rawCueBytes.clear()
      rawCueBytesTotal = 0
      decodedForContext = undefined
    }
  }
}
