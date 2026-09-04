import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureTrainingAudioOutput,
  createTrainingTtsPlayer,
  trainingTtsPlaybackRate,
  trainingTtsPlaybackTimeoutMs
} from '../uni-app/platform/trainingTts'

function createAudioContext() {
  return {
    src: '',
    autoplay: false,
    obeyMuteSwitch: false,
    playbackRate: 1,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn()
  }
}

function createWebContext() {
  return {
    currentTime: 100,
    destination: {},
    state: 'running',
    createBufferSource: vi.fn(() => ({
      buffer: undefined,
      onended: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    })),
    decodeAudioData: vi.fn((
      data: ArrayBuffer,
      success?: (buffer: unknown) => void,
      failure?: (error: unknown) => void
    ) => {
      success?.({ data })
      return undefined
    }),
    resume: vi.fn(),
    suspend: vi.fn(),
    close: vi.fn()
  }
}

function createWebRuntime(
  context: ReturnType<typeof createWebContext>,
  healthy = true
) {
  return {
    createContext: vi.fn(() => context),
    loadArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    isContextHealthy: vi.fn(() => healthy),
    ownsContext: false
  }
}

describe('trainingTts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('configures the global native output route through wx', () => {
    const setInnerAudioOption = vi.fn()
    vi.stubGlobal('wx', { setInnerAudioOption })

    configureTrainingAudioOutput()

    expect(setInnerAudioOption).toHaveBeenCalledWith(expect.objectContaining({
      obeyMuteSwitch: false,
      mixWithOther: false
    }))
  })

  it('plays each due cue only once', () => {
    const contexts = [createAudioContext(), createAudioContext()]
    const createContext = vi.fn()
      .mockReturnValueOnce(contexts[0])
      .mockReturnValueOnce(contexts[1])
    const player = createTrainingTtsPlayer(createContext)
    const cues = [
      { time: 0, text: '动作开始', audio_url: 'https://cdn.example.com/00.mp3' },
      { time: 8, text: '保持稳定', audio_url: 'https://cdn.example.com/01.mp3' }
    ]

    player.sync(cues, 0.2)
    player.sync(cues, 4)
    player.sync(cues, 8)
    contexts[0].onEnded.mock.calls[0][0]()

    expect(createContext).toHaveBeenCalledTimes(2)
    expect(contexts[0].src).toBe(cues[0].audio_url)
    expect(contexts[1].src).toBe(cues[1].audio_url)
    expect(contexts[0].play).toHaveBeenCalledOnce()
    expect(contexts[1].play).toHaveBeenCalledOnce()
  })

  it('queues every cue that becomes due in the same clock update', () => {
    const first = createAudioContext()
    const second = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const player = createTrainingTtsPlayer(createContext)
    const cues = [
      { time: 7, text: '准备下一动作', audio_url: 'https://cdn.example.com/go.mp3' },
      { time: 7, text: '三', audio_url: 'https://cdn.example.com/3.mp3' }
    ]

    player.sync(cues, 7)

    expect(first.src).toBe(cues[0].audio_url)
    first.onEnded.mock.calls[0][0]()
    expect(second.src).toBe(cues[1].audio_url)
  })

  it('plays the first action guidance after the start prompt', () => {
    const start = createAudioContext()
    const guidance = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(guidance)
    const player = createTrainingTtsPlayer(createContext)
    const cues = [{
      time: 0,
      text: '保持动作稳定',
      audio_url: 'https://cdn.example.com/guidance-00.mp3'
    }]

    player.enqueue(['https://cdn.example.com/start.mp3'])
    player.sync(cues, 0)

    expect(start.src).toBe('https://cdn.example.com/start.mp3')
    expect(guidance.play).not.toHaveBeenCalled()

    start.onEnded.mock.calls[0][0]()

    expect(guidance.src).toBe(cues[0].audio_url)
    expect(guidance.play).toHaveBeenCalledOnce()
  })

  it('stops the current cue and allows a fresh timeline after reset', () => {
    const first = createAudioContext()
    const second = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const player = createTrainingTtsPlayer(createContext)
    const cues = [
      { time: 0, text: '开始', audio_url: 'https://cdn.example.com/00.mp3' }
    ]

    player.sync(cues, 0)
    player.reset()
    player.sync(cues, 0)

    expect(first.stop).toHaveBeenCalledOnce()
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(second.play).toHaveBeenCalledOnce()
  })

  it('suspends and resumes the current cue without dropping queued speech', () => {
    const first = createAudioContext()
    const second = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const player = createTrainingTtsPlayer(createContext)

    player.enqueue([
      'https://cdn.example.com/first.mp3',
      'https://cdn.example.com/second.mp3'
    ])
    player.suspend()

    expect(first.pause).toHaveBeenCalledOnce()
    expect(second.play).not.toHaveBeenCalled()

    player.resume()
    expect(first.play).toHaveBeenCalledTimes(2)

    first.onEnded.mock.calls[0][0]()
    expect(second.play).toHaveBeenCalledOnce()
  })

  it('resets action cue history without interrupting countdown and start prompts', () => {
    const countdownOne = createAudioContext()
    const start = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(countdownOne)
      .mockReturnValueOnce(start)
    const player = createTrainingTtsPlayer(createContext)

    player.playUrl('https://cdn.example.com/countdown-1.mp3')
    player.resetTimeline()
    player.enqueue(['https://cdn.example.com/start.mp3'])

    expect(countdownOne.stop).not.toHaveBeenCalled()

    countdownOne.onEnded.mock.calls[0][0]()

    expect(start.src).toBe('https://cdn.example.com/start.mp3')
    expect(start.play).toHaveBeenCalledOnce()
  })

  it('carries an in-progress boundary cue into the next module without replaying stale queued speech', () => {
    const boundaryCue = createAudioContext()
    const nextModuleCue = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(boundaryCue)
      .mockReturnValueOnce(nextModuleCue)
    const player = createTrainingTtsPlayer(createContext)

    player.enqueue([
      'https://cdn.example.com/prepare-next-action.mp3',
      'https://cdn.example.com/stale-follow-up.mp3'
    ])
    player.advanceTimeline()
    player.enqueue(['https://cdn.example.com/next-module-start.mp3'])

    expect(boundaryCue.stop).not.toHaveBeenCalled()
    expect(boundaryCue.destroy).not.toHaveBeenCalled()

    boundaryCue.onEnded.mock.calls[0][0]()

    expect(nextModuleCue.src).toBe('https://cdn.example.com/next-module-start.mp3')
    expect(nextModuleCue.play).toHaveBeenCalledOnce()
    expect(createContext).toHaveBeenCalledTimes(2)
  })

  it('plays a shared audio URL on command', () => {
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    player.playUrl(' https://cdn.example.com/countdown.mp3 ')

    expect(context.src).toBe('https://cdn.example.com/countdown.mp3')
    expect(context.play).toHaveBeenCalledOnce()
    expect(context.obeyMuteSwitch).toBe(false)
    expect(context.playbackRate).toBe(trainingTtsPlaybackRate)
  })

  it('falls back to the uni runtime when the wx snapshot omits the audio factory', () => {
    const context = createAudioContext()
    const createInnerAudioContext = vi.fn(() => context)
    vi.stubGlobal('wx', {})
    vi.stubGlobal('uni', { createInnerAudioContext })
    const player = createTrainingTtsPlayer()

    player.playUrl('https://cdn.example.com/fallback.mp3')

    expect(createInnerAudioContext).toHaveBeenCalledOnce()
    expect(context.src).toBe('https://cdn.example.com/fallback.mp3')
    expect(context.play).toHaveBeenCalledOnce()
  })

  it('preloads remote audio and plays the local temporary file', async () => {
    const context = createAudioContext()
    const downloadFile = vi.fn(({ success }) => {
      success({
        statusCode: 200,
        tempFilePath: 'wxfile://tmp/countdown-3.mp3'
      })
    })
    const player = createTrainingTtsPlayer(
      () => context,
      { downloadFile }
    )
    const remoteUrl = 'https://cdn.example.com/countdown-3.mp3'

    await player.preload([remoteUrl, remoteUrl])
    player.enqueue([remoteUrl])

    expect(downloadFile).toHaveBeenCalledOnce()
    expect(context.src).toBe('wxfile://tmp/countdown-3.mp3')
    expect(context.play).toHaveBeenCalledOnce()
  })

  it('waits for an in-flight preload instead of downloading the same cue again', async () => {
    const context = createAudioContext()
    let completeDownload: ((result: { statusCode: number; tempFilePath: string }) => void) | undefined
    const downloadFile = vi.fn(({ success }) => {
      completeDownload = success
    })
    const player = createTrainingTtsPlayer(() => context, { downloadFile })
    const remoteUrl = 'https://cdn.example.com/first-action.mp3'

    const preloading = player.preload([remoteUrl])
    player.enqueue([remoteUrl])

    expect(downloadFile).toHaveBeenCalledOnce()
    expect(context.play).not.toHaveBeenCalled()

    completeDownload?.({
      statusCode: 200,
      tempFilePath: 'wxfile://tmp/first-action.mp3'
    })
    await preloading
    await Promise.resolve()

    expect(context.src).toBe('wxfile://tmp/first-action.mp3')
    expect(context.play).toHaveBeenCalledOnce()
  })

  it('does not play when a preload resolves after the session enters the background', async () => {
    const context = createAudioContext()
    let completeDownload: ((result: { statusCode: number; tempFilePath: string }) => void) | undefined
    const downloadFile = vi.fn(({ success }) => {
      completeDownload = success
    })
    const player = createTrainingTtsPlayer(() => context, { downloadFile })
    const remoteUrl = 'https://cdn.example.com/background-race.mp3'

    const preloading = player.preload([remoteUrl])
    const queued = player.enqueue([remoteUrl])
    player.suspend()

    completeDownload?.({
      statusCode: 200,
      tempFilePath: 'wxfile://tmp/background-race.mp3'
    })
    await preloading
    await queued

    expect(context.play).not.toHaveBeenCalled()

    player.resume()
    expect(context.play).not.toHaveBeenCalled()
  })

  it('does not start a countdown cue after its visible countdown has ended', async () => {
    const context = createAudioContext()
    let completeDownload: ((result: { statusCode: number; tempFilePath: string }) => void) | undefined
    const downloadFile = vi.fn(({ success }) => {
      completeDownload = success
    })
    const player = createTrainingTtsPlayer(() => context, { downloadFile })
    const remoteUrl = 'https://cdn.example.com/countdown-1.mp3'

    const preloading = player.preload([remoteUrl])
    player.enqueue([remoteUrl])
    player.cancelPendingPlayback()

    completeDownload?.({
      statusCode: 200,
      tempFilePath: 'wxfile://tmp/countdown-1.mp3'
    })
    await preloading
    await Promise.resolve()

    expect(context.play).not.toHaveBeenCalled()
  })

  it('retries the remote URL when a preloaded temporary file cannot play', async () => {
    const temporary = createAudioContext()
    const remote = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(temporary)
      .mockReturnValueOnce(remote)
    const downloadFile = vi.fn(({ success }) => {
      success({
        statusCode: 200,
        tempFilePath: 'wxfile://tmp/unplayable.mp3'
      })
    })
    const player = createTrainingTtsPlayer(createContext, { downloadFile })
    const remoteUrl = 'https://cdn.example.com/retry.mp3'

    await player.preload([remoteUrl])
    const completed = player.enqueue([remoteUrl])
    temporary.onError.mock.calls[0][0]({ errMsg: 'MEDIA_ERR_SRC_NOT_SUPPORTED' })

    expect(temporary.stop).toHaveBeenCalledOnce()
    expect(temporary.destroy).toHaveBeenCalledOnce()
    expect(remote.src).toBe(remoteUrl)
    expect(remote.play).toHaveBeenCalledOnce()

    remote.onEnded.mock.calls[0][0]()
    await expect(completed).resolves.toBeUndefined()
  })

  it('clears stale queued prompts when an immediate countdown cue takes priority', () => {
    const first = createAudioContext()
    const countdown = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(countdown)
    const player = createTrainingTtsPlayer(createContext)

    player.enqueue([
      'https://cdn.example.com/action-intro.mp3',
      'https://cdn.example.com/action-tip.mp3'
    ])
    player.playUrl('https://cdn.example.com/countdown-3.mp3')
    countdown.onEnded.mock.calls[0][0]()

    expect(first.stop).toHaveBeenCalledOnce()
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(countdown.src).toBe('https://cdn.example.com/countdown-3.mp3')
    expect(createContext).toHaveBeenCalledTimes(2)
  })

  it('replaces stale prompts with one uninterrupted countdown sequence', () => {
    const stalePrompt = createAudioContext()
    const countdownThree = createAudioContext()
    const countdownTwo = createAudioContext()
    const countdownOne = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(stalePrompt)
      .mockReturnValueOnce(countdownThree)
      .mockReturnValueOnce(countdownTwo)
      .mockReturnValueOnce(countdownOne)
    const player = createTrainingTtsPlayer(createContext)

    player.enqueue([
      'https://cdn.example.com/stale-current.mp3',
      'https://cdn.example.com/stale-queued.mp3'
    ])
    player.replace([
      'https://cdn.example.com/countdown-3.mp3',
      'https://cdn.example.com/countdown-2.mp3',
      'https://cdn.example.com/countdown-1.mp3'
    ])

    expect(stalePrompt.stop).toHaveBeenCalledOnce()
    expect(countdownThree.src).toBe('https://cdn.example.com/countdown-3.mp3')

    countdownThree.onEnded.mock.calls[0][0]()
    expect(countdownTwo.src).toBe('https://cdn.example.com/countdown-2.mp3')

    countdownTwo.onEnded.mock.calls[0][0]()
    expect(countdownOne.src).toBe('https://cdn.example.com/countdown-1.mp3')
    expect(createContext).toHaveBeenCalledTimes(4)
  })

  it('resolves an immediate cue after it has ended', async () => {
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    const completed = player.playUrl('https://cdn.example.com/end.mp3')
    context.onEnded.mock.calls[0][0]()

    await expect(completed).resolves.toBeUndefined()
  })

  it('resolves an immediate cue when the platform reports a playback error', async () => {
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    const completed = player.playUrl('https://cdn.example.com/end.mp3')
    context.onError.mock.calls[0][0]({ errMsg: 'downloadFile:fail url not in domain list' })

    await expect(completed).resolves.toBeUndefined()
    expect(context.destroy).toHaveBeenCalledOnce()
  })

  it('does not report idle until the final scheduled cue has finished', async () => {
    vi.useFakeTimers()
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    player.schedule([{
      time: 1,
      text: '动作完成',
      audio_url: 'https://cdn.example.com/complete.mp3'
    }])
    const idle = player.waitForIdle()
    const observed = vi.fn()
    void idle.then(observed)

    await vi.advanceTimersByTimeAsync(999)
    expect(context.play).not.toHaveBeenCalled()
    expect(observed).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(context.play).toHaveBeenCalledOnce()
    expect(observed).not.toHaveBeenCalled()

    context.onEnded.mock.calls[0][0]()
    await expect(idle).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  it('releases a stalled native audio context after the playback watchdog', async () => {
    vi.useFakeTimers()
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    const completed = player.playUrl('https://cdn.example.com/stalled.mp3')
    await vi.advanceTimersByTimeAsync(trainingTtsPlaybackTimeoutMs)

    await expect(completed).resolves.toBeUndefined()
    expect(context.stop).toHaveBeenCalledOnce()
    expect(context.destroy).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('queues short transition audio in order', () => {
    const first = createAudioContext()
    const second = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const player = createTrainingTtsPlayer(createContext)

    player.enqueue([
      'https://cdn.example.com/end.mp3',
      'https://cdn.example.com/rest-next.mp3'
    ])
    first.onEnded.mock.calls[0][0]()

    expect(first.src).toBe('https://cdn.example.com/end.mp3')
    expect(second.src).toBe('https://cdn.example.com/rest-next.mp3')
    expect(first.play).toHaveBeenCalledOnce()
    expect(second.play).toHaveBeenCalledOnce()
  })

  it('waits for every queued cue before reporting an idle player', async () => {
    const first = createAudioContext()
    const second = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const player = createTrainingTtsPlayer(createContext)

    player.enqueue([
      'https://cdn.example.com/end.mp3',
      'https://cdn.example.com/complete.mp3'
    ])
    const idle = player.waitForIdle()
    const observed = vi.fn()
    void idle.then(observed)

    first.onEnded.mock.calls[0][0]()
    await Promise.resolve()
    expect(observed).not.toHaveBeenCalled()

    second.onEnded.mock.calls[0][0]()
    await expect(idle).resolves.toBeUndefined()
    expect(observed).toHaveBeenCalledOnce()
  })

  it('becomes idle after a suspended native player reaches its watchdog', async () => {
    vi.useFakeTimers()
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    player.enqueue(['https://cdn.example.com/stalled.mp3'])
    player.suspend()
    const idle = player.waitForIdle()

    await vi.advanceTimersByTimeAsync(trainingTtsPlaybackTimeoutMs)
    await expect(idle).resolves.toBeUndefined()
    expect(context.destroy).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('continues from an immediate countdown into end and rest prompts', async () => {
    const countdownOne = createAudioContext()
    const end = createAudioContext()
    const restNext = createAudioContext()
    const createContext = vi.fn()
      .mockReturnValueOnce(countdownOne)
      .mockReturnValueOnce(end)
      .mockReturnValueOnce(restNext)
    const player = createTrainingTtsPlayer(createContext)

    player.playUrl('https://cdn.example.com/countdown-1.mp3')
    const completed = player.enqueue([
      'https://cdn.example.com/end.mp3',
      'https://cdn.example.com/rest-next.mp3'
    ])

    countdownOne.onEnded.mock.calls[0][0]()

    expect(end.src).toBe('https://cdn.example.com/end.mp3')
    expect(end.play).toHaveBeenCalledOnce()

    end.onEnded.mock.calls[0][0]()

    expect(restNext.src).toBe('https://cdn.example.com/rest-next.mp3')
    expect(restNext.play).toHaveBeenCalledOnce()

    restNext.onEnded.mock.calls[0][0]()
    await expect(completed).resolves.toBeUndefined()
  })

  it('plays cues through the shared web audio context without a native player', async () => {
    const webContext = createWebContext()
    const createNative = vi.fn(createAudioContext)
    const player = createTrainingTtsPlayer(
      createNative,
      null,
      undefined,
      createWebRuntime(webContext)
    )

    const done = player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(webContext.createBufferSource).toHaveBeenCalled())
    const source = webContext.createBufferSource.mock.results[0].value
    expect(source.start).toHaveBeenCalledWith(100)
    expect(createNative).not.toHaveBeenCalled()

    let idle = false
    void player.waitForIdle().then(() => { idle = true })
    await Promise.resolve()
    expect(idle).toBe(false)

    source.onended()
    await expect(done).resolves.toBeUndefined()
    await player.waitForIdle()
    expect(idle).toBe(true)
  })

  it('falls back to the native player while the shared context reports unhealthy', async () => {
    const webContext = createWebContext()
    const native = createAudioContext()
    const player = createTrainingTtsPlayer(
      vi.fn(() => native),
      null,
      undefined,
      createWebRuntime(webContext, false)
    )

    void player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(native.play).toHaveBeenCalled())
    expect(native.src).toBe('https://cdn.example.com/cue.mp3')
    expect(webContext.createBufferSource).not.toHaveBeenCalled()
  })

  it('falls back to the native player when the cue fails to decode', async () => {
    const webContext = createWebContext()
    webContext.decodeAudioData.mockImplementation((
      _data: ArrayBuffer,
      _success?: (buffer: unknown) => void,
      failure?: (error: unknown) => void
    ) => {
      failure?.(new Error('unsupported format'))
      return undefined
    })
    const native = createAudioContext()
    const player = createTrainingTtsPlayer(
      vi.fn(() => native),
      null,
      undefined,
      createWebRuntime(webContext)
    )

    void player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(native.play).toHaveBeenCalled())
    expect(webContext.createBufferSource).not.toHaveBeenCalled()
  })

  it('suspends mid-cue and resumes the web audio playback from the offset', async () => {
    const webContext = createWebContext()
    const player = createTrainingTtsPlayer(
      vi.fn(createAudioContext),
      null,
      undefined,
      createWebRuntime(webContext)
    )

    void player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(webContext.createBufferSource).toHaveBeenCalled())
    const firstSource = webContext.createBufferSource.mock.results[0].value

    webContext.currentTime = 102.5
    player.suspend()
    expect(firstSource.stop).toHaveBeenCalledOnce()

    webContext.currentTime = 110
    player.resume()
    await vi.waitFor(() => {
      expect(webContext.createBufferSource.mock.results.length).toBe(2)
    })
    const secondSource = webContext.createBufferSource.mock.results[1].value
    expect(secondSource.start).toHaveBeenCalledWith(110, 2.5)
  })

  it('completes a pending web audio cue when the timeline resets', async () => {
    const webContext = createWebContext()
    const player = createTrainingTtsPlayer(
      vi.fn(createAudioContext),
      null,
      undefined,
      createWebRuntime(webContext)
    )

    const done = player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(webContext.createBufferSource).toHaveBeenCalled())

    player.reset()
    await expect(done).resolves.toBeUndefined()
  })

  it('re-decodes from cached bytes after the shared context is rebuilt', async () => {
    const firstContext = createWebContext()
    const secondContext = createWebContext()
    const runtime = createWebRuntime(firstContext)
    const player = createTrainingTtsPlayer(
      vi.fn(createAudioContext),
      null,
      undefined,
      runtime
    )

    void player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(firstContext.createBufferSource).toHaveBeenCalled())
    expect(runtime.loadArrayBuffer).toHaveBeenCalledTimes(1)

    runtime.createContext.mockImplementation(() => secondContext)
    void player.playUrl('https://cdn.example.com/cue.mp3')
    await vi.waitFor(() => expect(secondContext.createBufferSource).toHaveBeenCalled())
    // The compressed bytes survive the rebuild; only the decode repeats.
    expect(runtime.loadArrayBuffer).toHaveBeenCalledTimes(1)
    expect(secondContext.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('preloads each cue with a single CDN fetch and starts without a download', async () => {
    const webContext = createWebContext()
    const runtime = createWebRuntime(webContext)
    const player = createTrainingTtsPlayer(
      vi.fn(createAudioContext),
      null,
      undefined,
      runtime
    )

    await player.preload([
      'https://cdn.example.com/a.mp3',
      'https://cdn.example.com/a.mp3',
      'https://cdn.example.com/b.mp3'
    ])
    expect(runtime.loadArrayBuffer).toHaveBeenCalledTimes(2)

    void player.playUrl('https://cdn.example.com/a.mp3')
    await vi.waitFor(() => expect(webContext.createBufferSource).toHaveBeenCalled())
    expect(runtime.loadArrayBuffer).toHaveBeenCalledTimes(2)
  })
})
