import { describe, expect, it } from 'vitest'
import {
  buildActionExportFile,
  createUniqueJsonFilenames,
  safeJsonFilename
} from '../tools/action-standard/actionExport'
import type { RawPoseSample } from '../tools/action-standard/types'

function completePose() {
  const keypoints = [
    { name: 'left_shoulder', x: 10, y: 20, score: 0.98 },
    { name: 'right_shoulder', x: 30, y: 20, score: 0.97 },
    { name: 'left_elbow', x: 8, y: 40, score: 0.96 },
    { name: 'right_elbow', x: 32, y: 40, score: 0.95 },
    { name: 'left_wrist', x: 6, y: 60, score: 0.94 },
    { name: 'right_wrist', x: 34, y: 60, score: 0.93 },
    { name: 'left_hip', x: 12, y: 70, score: 0.99 },
    { name: 'right_hip', x: 28, y: 70, score: 0.99 },
    { name: 'left_knee', x: 12, y: 100, score: 0.92 },
    { name: 'right_knee', x: 28, y: 100, score: 0.91 },
    { name: 'left_ankle', x: 12, y: 130, score: 0.9 },
    { name: 'right_ankle', x: 28, y: 130, score: 0.89 }
  ]
  return {
    keypoints,
    keypoints3D: keypoints.map(point => ({ ...point, z: point.x / 100 }))
  }
}

function actionItem() {
  return {
    actionName: '两手攀足',
    note: '正面拍摄',
    file: new File(['video'], '两手攀足.mp4', { type: 'video/mp4' })
  }
}

describe('action export builder', () => {
  it('exports raw 2D landmarks, visibility, and angles in the 0.5 schema', () => {
    const samples: RawPoseSample[] = [
      { time: 3, pose: completePose() },
      { time: 3.017, pose: completePose() }
    ]

    const file = buildActionExportFile(actionItem(), samples, {
      exportedBy: 'researcher',
      sourceFps: 60,
      exportedAt: '2026-07-23T08:00:00.000Z'
    })

    expect(file).toMatchObject({
      schema_version: '0.5',
      action_name: '两手攀足',
      landmark_names: expect.arrayContaining(['left_shoulder', 'right_ankle']),
      angle_names: expect.arrayContaining(['left_elbow', 'torso_rotation']),
      metadata: {
        exported_by: 'researcher',
        exported_at: '2026-07-23T08:00:00.000Z',
        source_video: '两手攀足.mp4',
        source_fps: 60,
        note: '正面拍摄'
      }
    })
    expect(file.frames).toHaveLength(2)
    expect(file.frames[0].frame_index).toBe(0)
    expect(file.frames[0].time).toBe(0)
    expect(file.frames[0].landmarks_2d[0]).toEqual([10, 20])
    expect(file.frames[0].landmark_visibility[0]).toBe(0.98)
    expect(file.frames[1].time).toBe(0.017)
    expect(file.frames[0].angles).toHaveLength(9)
  })

  it('keeps frames with no detected pose as null raw values', () => {
    const file = buildActionExportFile(actionItem(), [{ time: 0, pose: null }], {
      exportedBy: '',
      sourceFps: 30
    })

    expect(file.frames[0].landmarks_2d).toEqual(Array(12).fill(null))
    expect(file.frames[0].landmark_visibility).toEqual(Array(12).fill(null))
    expect(file.frames[0].angles).toEqual(Array(9).fill(null))
  })

  it('uses a portable action-export JSON filename', () => {
    expect(safeJsonFilename('两手/攀足')).toBe('两手_攀足.json')
    expect(createUniqueJsonFilenames(['两手攀足', '两手攀足', '两手/攀足'])).toEqual([
      '两手攀足.json',
      '两手攀足-2.json',
      '两手_攀足.json'
    ])
  })
})
