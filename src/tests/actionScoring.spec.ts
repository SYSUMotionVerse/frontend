import { describe, expect, it } from 'vitest'
import { aggregateActionScores, scoreAction } from '../domain/training/actionScoring'
import {
  ACTION_ANGLE_NAMES,
  type ActionMotion,
  type ActionStandard
} from '../domain/training/actionScoringTypes'

function createStandard(sequence: number[][]): ActionStandard {
  return {
    schema_version: '0.4',
    action_id: 'demo',
    action_name: '评分演示',
    action_type: 'repetitive',
    fps: 10,
    angle_unit: 'radian',
    angle_names: [...ACTION_ANGLE_NAMES],
    standard_sequence: sequence,
    angle_rules: Object.fromEntries(ACTION_ANGLE_NAMES.map(name => [name, {
      enabled: true,
      weight: 1,
      tolerance: 0.35,
      feedback: { too_small: '', too_large: '' }
    }]))
  }
}

function createMotion(sequence: Array<Array<number | null>>): ActionMotion {
  return {
    angle_names: [...ACTION_ANGLE_NAMES],
    frames: sequence.map((angles, index) => ({
      frame_index: index,
      time: index / 10,
      angles
    }))
  }
}

function createSequence() {
  return Array.from({ length: 10 }, (_, frameIndex) => (
    Array.from({ length: 9 }, (_, angleIndex) => (
      1.4 + 0.1 * Math.sin(frameIndex / 2 + angleIndex / 5)
    ))
  ))
}

describe('scoreAction', () => {
  it('scores a matching sequence at 100', () => {
    const sequence = createSequence()

    const result = scoreAction(createStandard(sequence), createMotion(sequence))

    expect(result.score).toBeCloseTo(100, 10)
    expect(result.passed).toBe(true)
    expect(result.feedback).toEqual([])
  })

  it('reports a consistently undersized joint angle', () => {
    const sequence = createSequence()
    const leftKneeIndex = ACTION_ANGLE_NAMES.indexOf('left_knee')
    const biased = sequence.map(row => row.map((value, index) => (
      index === leftKneeIndex ? value - 0.5 : value
    )))

    const result = scoreAction(createStandard(sequence), createMotion(biased))

    expect(result.feedback).toContainEqual(expect.objectContaining({
      angle: 'left_knee',
      direction: 'too_small'
    }))
    expect(result.angle_details.left_knee?.mean_error).toBeCloseTo(0.5, 10)
  })

  it('resamples a shorter motion to the standard length', () => {
    const sequence = createSequence()
    const shorter = [sequence[0], sequence[3], sequence[6], sequence[9]]

    const result = scoreAction(createStandard(sequence), createMotion(shorter))

    expect(result.debug.user_frames).toBe(4)
    expect(result.score).toBeGreaterThan(95)
  })

  it('interpolates invalid angle values by frame time', () => {
    const sequence = createSequence()
    const invalid = sequence.map(row => [...row] as Array<number | null>)
    invalid[2][0] = null
    invalid[3][0] = Number.NaN
    invalid[4][1] = null

    const result = scoreAction(createStandard(sequence), createMotion(invalid))

    expect(result.debug.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('已按时间插值修复')
    ]))
    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('normalizes raw configured weights only when calculating the score', () => {
    const sequence = createSequence()
    const standard = createStandard(sequence)
    for (const name of ACTION_ANGLE_NAMES) {
      standard.angle_rules[name]!.enabled = name === 'left_elbow' || name === 'left_shoulder'
    }
    standard.angle_rules.left_elbow!.weight = 1
    standard.angle_rules.left_shoulder!.weight = 2

    const result = scoreAction(standard, createMotion(sequence))

    expect(result.angle_details.left_elbow?.weight).toBe(1)
    expect(result.angle_details.left_shoulder?.weight).toBe(2)
    expect(result.angle_details.left_elbow?.normalized_weight).toBeCloseTo(1 / 3)
    expect(result.angle_details.left_shoulder?.normalized_weight).toBeCloseTo(2 / 3)
  })

  it('uses DTW to align local timing differences', () => {
    const standardKnee = [0.4, 0.4, 0.8, 1.2, 1.6, 1.2, 0.8, 0.4]
    const warpedKnee = [0.4, 0.4, 0.4, 0.4, 0.8, 1.2, 1.6, 1.2, 0.8, 0.4]
    const toRows = (values: number[]) => values.map(value => [
      1, 1, 1, 1, 1, 1, value, 1, 0
    ])
    const standard = createStandard(toRows(standardKnee))
    for (const name of ACTION_ANGLE_NAMES) {
      standard.angle_rules[name]!.enabled = name === 'left_knee'
    }
    const motion = createMotion(toRows(warpedKnee))

    const resampled = scoreAction(standard, motion, { alignmentMethod: 'resample' })
    const dtw = scoreAction(standard, motion, { alignmentMethod: 'dtw' })

    expect(dtw.score).toBeGreaterThan(resampled.score)
    expect(dtw.score).toBeCloseTo(100, 10)
    expect(dtw.debug.alignment_path_length).toBeGreaterThanOrEqual(warpedKnee.length)
  })

  it('rejects an action with no enabled usable angles', () => {
    const sequence = createSequence()
    const standard = createStandard(sequence)
    for (const name of ACTION_ANGLE_NAMES) {
      standard.angle_rules[name]!.enabled = false
    }

    expect(() => scoreAction(standard, createMotion(sequence))).toThrow(
      '没有可用于评分的已启用且有效角度'
    )
  })
})

describe('aggregateActionScores', () => {
  it('weights valid actions by expected duration', () => {
    const result = aggregateActionScores([
      {
        itemId: 1,
        videoId: 11,
        actionId: 'short-action',
        title: '短动作',
        expectedDuration: 10,
        score: 100,
        passed: true,
        feedback: [],
        angleDetails: {},
        frameCount: 50
      },
      {
        itemId: 2,
        videoId: 12,
        actionId: 'long-action',
        title: '长动作',
        expectedDuration: 30,
        score: 80,
        passed: true,
        feedback: [],
        angleDetails: {},
        frameCount: 150
      }
    ])

    expect(result.score).toBe(85)
    expect(result.dimensions).toHaveLength(2)
    expect(result.summary).toContain('85 分')
  })

  it('does not turn unavailable actions into zero scores', () => {
    const result = aggregateActionScores([], ['标准文件不可用'])

    expect(result.score).toBeUndefined()
    expect(result.warnings).toEqual(['标准文件不可用'])
  })
})
