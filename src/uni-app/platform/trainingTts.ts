import type { ActionTtsCue } from '../../domain/training/actionScoringTypes'

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

type WechatAudioFactory = typeof wx & {
  createInnerAudioContext?: () => InnerAudioContextLike
}

const audioDownloadTimeoutMs = 30_000
const audioPreloadConcurrency = 4
// The server-generated assets already use the configured natural speech rate
// (`zh-CN-XiaoxiaoNeural`, -5%). Keep native playback at 1x so the database
// timing plan can be checked against the actual MP3 duration without an
// invisible 12% slowdown that truncates cues at phase boundaries.
export const trainingTtsPlaybackRate = 1

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
  )
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

  function resolveIdleWaiters() {
    if (audioContext || queuedAudioUrls.length > 0 || suspended) return
    const waiters = idleWaiters
    idleWaiters = []
    waiters.forEach(resolve => resolve())
  }

  function waitForIdle() {
    if (!audioContext && queuedAudioUrls.length === 0 && !suspended) {
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

  function stopAudio() {
    stopCurrentPlayback?.()
  }

  function playAudioUrl(
    audioUrl: string,
    onComplete?: () => void,
    allowPreloadedSource = true,
    expectedGeneration = playbackGeneration
  ): Promise<void> {
    const normalizedUrl = audioUrl.trim()
    if (!normalizedUrl) {
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
        return playAudioUrl(
          normalizedUrl,
          onComplete,
          allowPreloadedSource,
          expectedGeneration
        )
      })
    }

    return new Promise<void>(resolve => {
      stopAudio()
      suspended = false
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
      audioContext = nextAudioContext
      const sourceUrl = allowPreloadedSource
        ? preloadedSources.get(normalizedUrl) ?? normalizedUrl
        : normalizedUrl
      const dispose = (stopFirst = false, complete = true) => {
        if (settled) return
        settled = true
        if (audioContext === nextAudioContext) audioContext = undefined
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
        if (sourceUrl === normalizedUrl || !allowPreloadedSource) return false
        if (preloadedSources.get(normalizedUrl) === sourceUrl) {
          preloadedSources.delete(normalizedUrl)
        }
        dispose(true, false)
        void playAudioUrl(normalizedUrl, onComplete, false, expectedGeneration).then(resolve)
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
        nextAudioContext.play?.()
      } catch (error) {
        console.warn('[TrainingTts] playback setup failed:', error)
        if (!retryWithRemoteSource()) dispose()
      }
    })
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
    if (audioContext || suspended) return
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
      clearQueuedAudio()
      stopAudio()
      playedCueIndexes = new Set()
    },
    resetTimeline(options: { interrupt?: boolean } = {}) {
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
      clearQueuedAudio()
      playedCueIndexes = new Set()
    },
    // Keep a cue that has already reached the native audio player, but cancel
    // anything still waiting for a COS preload (or queued behind it). This is
    // used at a countdown boundary so a slow download cannot speak after the
    // visible 3/2/1 overlay has gone away.
    cancelPendingPlayback() {
      playbackGeneration += 1
      clearQueuedAudio()
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
      return preloadAudioUrls(audioUrls)
    },
    waitForIdle,
    pause() {
      playbackGeneration += 1
      suspended = false
      clearQueuedAudio()
      stopAudio()
    },
    suspend() {
      if (audioContext) {
        if (!audioContext.pause) return
        suspended = true
        audioContext.pause()
        return
      }
      // Keep a not-yet-started queue suspended as well. This can happen when
      // buffering wins a race with audio-context creation; resume() will then
      // drain it once the video reports progress again.
      if (queuedAudioUrls.length > 0) suspended = true
    },
    resume() {
      if (!suspended) return
      suspended = false
      if (audioContext) {
        audioContext.play?.()
      } else {
        playNextQueuedAudio()
      }
    },
    destroy() {
      playbackGeneration += 1
      suspended = false
      clearQueuedAudio()
      stopAudio()
      playedCueIndexes = new Set()
    }
  }
}
