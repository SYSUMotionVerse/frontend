import { describe, expect, it, vi } from 'vitest'
import {
  createActionStandardLoader,
  mapWithConcurrency,
  parseActionStandard
} from '../uni-app/platform/actionStandardLoader'
import { ACTION_ANGLE_NAMES } from '../domain/training/actionScoringTypes'

function validStandard() {
  return {
    action_id: 'squat',
    action_type: 'repetitive',
    angle_unit: 'radian',
    angle_names: [...ACTION_ANGLE_NAMES],
    standard_sequence: [[1, 1, 1, 1, 1, 1, 1, 1, 0]],
    angle_rules: {
      left_knee: { enabled: true, weight: 1, tolerance: 0.35 }
    }
  }
}

describe('actionStandardLoader', () => {
  it('validates the standard action contract', () => {
    expect(parseActionStandard(JSON.stringify(validStandard())).action_id).toBe('squat')
    expect(() => parseActionStandard({ ...validStandard(), action_type: 'hold' })).toThrow(
      "action_type='repetitive'"
    )
  })

  it('validates optional TTS cues', () => {
    expect(parseActionStandard({
      ...validStandard(),
      countdown_audio_url: 'https://cdn.example.com/countdown.mp3',
      countdown_audio_urls: {
        '1': 'https://cdn.example.com/1.mp3',
        '2': 'https://cdn.example.com/2.mp3',
        '3': 'https://cdn.example.com/3.mp3'
      },
      transition_audio_urls: {
        start: 'https://cdn.example.com/start.mp3',
        end: 'https://cdn.example.com/end.mp3',
        next_action: 'https://cdn.example.com/next.mp3',
        rest_next_action: 'https://cdn.example.com/rest-next.mp3'
      },
      tts_cues: [{
        time: 0,
        text: '动作开始',
        audio_url: 'https://cdn.example.com/00.mp3'
      }]
    }).tts_cues).toHaveLength(1)
    expect(() => parseActionStandard({
      ...validStandard(),
      countdown_audio_url: ''
    })).toThrow('countdown_audio_url')
    expect(() => parseActionStandard({
      ...validStandard(),
      countdown_audio_urls: { '1': 'https://cdn.example.com/1.mp3' }
    })).toThrow('countdown_audio_urls')
    expect(() => parseActionStandard({
      ...validStandard(),
      transition_audio_urls: { start: 'https://cdn.example.com/start.mp3' }
    })).toThrow('transition_audio_urls')
    expect(() => parseActionStandard({
      ...validStandard(),
      tts_cues: [{ time: -1, text: '动作开始', audio_url: '' }]
    })).toThrow('tts_cues')
  })

  it('deduplicates concurrent requests for the same URL', async () => {
    const requestJson = vi.fn().mockResolvedValue(validStandard())
    const loader = createActionStandardLoader({ requestJson })

    const [first, second] = await Promise.all([
      loader.load('https://cdn.example.com/squat.json'),
      loader.load('https://cdn.example.com/squat.json')
    ])

    expect(first).toBe(second)
    expect(requestJson).toHaveBeenCalledTimes(1)
  })

  it('evicts a failed request so it can be retried', async () => {
    const requestJson = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(validStandard())
    const loader = createActionStandardLoader({ requestJson })
    const url = 'https://cdn.example.com/squat.json'

    await expect(loader.load(url)).rejects.toThrow('network')
    await expect(loader.load(url)).resolves.toEqual(expect.objectContaining({ action_id: 'squat' }))
    expect(requestJson).toHaveBeenCalledTimes(2)
  })

  it('keeps different published ETags in separate cache entries', async () => {
    const requestJson = vi.fn().mockResolvedValue(validStandard())
    const loader = createActionStandardLoader({ requestJson })
    const url = 'https://cdn.example.com/squat.json'

    await loader.load(url, 'etag-v1')
    await loader.load(url, 'etag-v2')

    expect(requestJson).toHaveBeenNthCalledWith(1, url, 'etag-v1')
    expect(requestJson).toHaveBeenNthCalledWith(2, url, 'etag-v2')
  })

  it('limits concurrent standard-data work while retaining item order', async () => {
    const completions: Array<() => void> = []
    let active = 0
    let peakActive = 0
    const result = mapWithConcurrency([1, 2, 3, 4], async item => {
      active += 1
      peakActive = Math.max(peakActive, active)
      await new Promise<void>(resolve => completions.push(resolve))
      active -= 1
      return item * 2
    }, 2)

    await vi.waitFor(() => expect(completions).toHaveLength(2))
    expect(peakActive).toBe(2)

    while (completions.length > 0) {
      completions.shift()?.()
      await Promise.resolve()
    }

    await expect(result).resolves.toEqual([2, 4, 6, 8])
    expect(peakActive).toBe(2)
  })
})
