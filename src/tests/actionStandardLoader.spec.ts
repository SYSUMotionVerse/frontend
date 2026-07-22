import { describe, expect, it, vi } from 'vitest'
import { createActionStandardLoader, parseActionStandard } from '../uni-app/platform/actionStandardLoader'
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
})
