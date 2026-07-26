import { describe, expect, it, vi } from 'vitest'
import { createTrainingTtsPlayer } from '../uni-app/platform/trainingTts'

function createAudioContext() {
  return {
    src: '',
    autoplay: false,
    obeyMuteSwitch: false,
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn()
  }
}

describe('trainingTts', () => {
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

  it('plays a shared audio URL on command', () => {
    const context = createAudioContext()
    const player = createTrainingTtsPlayer(() => context)

    player.playUrl(' https://cdn.example.com/countdown.mp3 ')

    expect(context.src).toBe('https://cdn.example.com/countdown.mp3')
    expect(context.play).toHaveBeenCalledOnce()
    expect(context.obeyMuteSwitch).toBe(false)
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
})
