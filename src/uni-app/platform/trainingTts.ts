import type { ActionTtsCue } from '../../domain/training/actionScoringTypes'

interface InnerAudioContextLike {
  src: string
  autoplay: boolean
  obeyMuteSwitch?: boolean
  play?: () => void
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
    fail?: () => void
  }) => unknown
}

type WechatAudioFactory = typeof wx & {
  createInnerAudioContext?: () => InnerAudioContextLike
}

const audioDownloadTimeoutMs = 30_000
const audioPreloadConcurrency = 4

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
    return wechatApi?.createInnerAudioContext?.()
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
  let queuedAudioUrls: Array<{
    url: string
    resolve: () => void
  }> = []
  const preloadedSources = new Map<string, string>()
  const pendingPreloads = new Map<string, Promise<void>>()

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
          }
          resolve()
        },
        fail: resolve
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

  function playAudioUrl(audioUrl: string, onComplete?: () => void) {
    const normalizedUrl = audioUrl.trim()
    if (!normalizedUrl) {
      onComplete?.()
      return Promise.resolve()
    }

    return new Promise<void>(resolve => {
      stopAudio()
      const nextAudioContext = createAudioContext()
      if (!nextAudioContext) {
        onComplete?.()
        resolve()
        return
      }

      let settled = false
      audioContext = nextAudioContext
      nextAudioContext.autoplay = false
      nextAudioContext.obeyMuteSwitch = false
      nextAudioContext.src = preloadedSources.get(normalizedUrl) ?? normalizedUrl
      const dispose = (stopFirst = false) => {
        if (settled) return
        settled = true
        if (audioContext === nextAudioContext) audioContext = undefined
        if (stopCurrentPlayback === stopPlayback) stopCurrentPlayback = undefined
        if (stopFirst) nextAudioContext.stop?.()
        nextAudioContext.destroy?.()
        onComplete?.()
        resolve()
      }
      const stopPlayback = () => dispose(true)
      stopCurrentPlayback = stopPlayback
      nextAudioContext.onEnded?.(() => dispose())
      nextAudioContext.onError?.(error => {
        console.warn('[TrainingTts] playback failed:', error)
        dispose()
      })
      nextAudioContext.play?.()
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
    if (audioContext) return
    const nextAudio = queuedAudioUrls.shift()
    if (!nextAudio) return
    void playAudioUrl(nextAudio.url, () => {
      nextAudio.resolve()
      playNextQueuedAudio()
    })
  }

  function clearQueuedAudio() {
    const queued = queuedAudioUrls
    queuedAudioUrls = []
    queued.forEach(item => item.resolve())
  }

  return {
    reset() {
      clearQueuedAudio()
      stopAudio()
      playedCueIndexes = new Set()
    },
    resetTimeline() {
      playedCueIndexes = new Set()
    },
    sync(cues: readonly ActionTtsCue[], elapsedSeconds: number) {
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return
      const normalized = normalizeCues(cues)
      const nextCueIndex = normalized.findIndex(
        (cue, index) => cue.time <= elapsedSeconds && !playedCueIndexes.has(index)
      )
      if (nextCueIndex < 0) return

      playedCueIndexes.add(nextCueIndex)
      enqueueAudioUrls([normalized[nextCueIndex].audio_url])
    },
    playUrl(audioUrl: string) {
      clearQueuedAudio()
      return playAudioUrl(audioUrl, playNextQueuedAudio)
    },
    enqueue(audioUrls: readonly string[]) {
      return enqueueAudioUrls(audioUrls)
    },
    replace(audioUrls: readonly string[]) {
      clearQueuedAudio()
      stopAudio()
      return enqueueAudioUrls(audioUrls)
    },
    preload(audioUrls: readonly string[]) {
      return preloadAudioUrls(audioUrls)
    },
    pause() {
      clearQueuedAudio()
      stopAudio()
    },
    destroy() {
      clearQueuedAudio()
      stopAudio()
      playedCueIndexes = new Set()
    }
  }
}
