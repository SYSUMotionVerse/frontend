import { describe, expect, it } from 'vitest'
import { buildActionStandardFile, buildSmoothedAngleSequence, createDefaultAngleRules, validateTrimRange } from '../tools/action-standard/actionStandard'
import type { RawPoseSample } from '../tools/action-standard/types'

function completePose() {
  const keypoints3D = [
    { name: 'left_shoulder', x: -1, y: 2, z: 0.1, score: 1 },
    { name: 'right_shoulder', x: 1, y: 2, z: -0.1, score: 1 },
    { name: 'left_elbow', x: -2, y: 1, z: 0, score: 1 },
    { name: 'right_elbow', x: 2, y: 1, z: 0, score: 1 },
    { name: 'left_wrist', x: -2, y: 0, z: 0, score: 1 },
    { name: 'right_wrist', x: 2, y: 0, z: 0, score: 1 },
    { name: 'left_hip', x: -0.7, y: 0, z: 0.05, score: 1 },
    { name: 'right_hip', x: 0.7, y: 0, z: -0.05, score: 1 },
    { name: 'left_knee', x: -0.8, y: -2, z: 0, score: 1 },
    { name: 'right_knee', x: 0.8, y: -2, z: 0, score: 1 },
    { name: 'left_ankle', x: -0.7, y: -4, z: 0, score: 1 },
    { name: 'right_ankle', x: 0.7, y: -4, z: 0, score: 1 }
  ]
  return {
    keypoints: keypoints3D.map(point => ({ ...point, x: point.x * 10, y: point.y * 10 })),
    keypoints3D
  }
}

describe('action standard exporter', () => {
  it('creates the nine angle rules with the same weighting as the reference standard', () => {
    const rules = createDefaultAngleRules()
    expect(Object.keys(rules)).toHaveLength(9)
    expect(rules.left_shoulder.weight).toBeCloseTo(2 / 14)
    expect(rules.left_elbow.tolerance).toBeCloseTo(20 * Math.PI / 180)
  })

  it('interpolates missing samples and applies a centered moving average', () => {
    const samples: RawPoseSample[] = [
      { time: 0, pose: completePose() },
      { time: 0.1, pose: null },
      { time: 0.2, pose: completePose() }
    ]
    const rows = buildSmoothedAngleSequence(samples)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveLength(9)
    expect(rows[1]).toEqual(rows[0])
  })

  it('emits schema 0.4 metadata and preserves sorted speech cues', () => {
    const file = buildActionStandardFile({
      actionId: 'bend',
      actionName: '前屈',
      actionType: 'repetitive',
      createdBy: 'tester',
      note: 'note',
      ttsCues: [{ time: 2, text: 'later' }, { time: 1, text: 'first' }]
    }, [{ time: 0, pose: completePose() }])
    expect(file.schema_version).toBe('0.4')
    expect(file.angle_names).toHaveLength(9)
    expect(file.tts_cues.map(cue => cue.time)).toEqual([1, 2])
    expect(file.metadata.preprocessing_info.target_fps).toBe(10)
  })

  it('accepts browser duration rounding at the video boundary', () => {
    expect(validateTrimRange(0, 30.067, 30.066667)).toBe('')
    expect(validateTrimRange(0, 30.08, 30.066667)).toBe('截取时间范围无效')
    expect(validateTrimRange(4, 3, 30.066667)).toBe('截取时间范围无效')
  })
})
