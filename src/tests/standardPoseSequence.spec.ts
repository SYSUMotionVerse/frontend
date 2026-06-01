import { describe, expect, it } from 'vitest'
import type { DetectResult } from '../uni-app/components/pose/PoseDetectModel'
import { buildStandardPoseSequence } from '../uni-app/components/pose/standardPoseSequence'

function createDetectResult(input: {
  frameIndex: number
  tsMs: number
  keypoints3D?: Array<{ name: string; x: number; y: number; z: number; score?: number }>
  keypoints2D?: Array<{ name: string; x: number; y: number; score?: number }>
  angleFrame?: DetectResult['angleFrame']
}): DetectResult & { frameIndex: number } {
  return {
    frameIndex: input.frameIndex,
    tsMs: input.tsMs,
    inferMs: 16,
    pose: {
      keypoints: input.keypoints2D ?? [],
      keypoints3D: input.keypoints3D
    },
    angleFrame: input.angleFrame ?? null
  }
}

describe('buildStandardPoseSequence', () => {
  it('builds the standard action sequence with ordered landmarks, accurate timestamps, optional visibility, and ordered angles', () => {
    const sequence = buildStandardPoseSequence([
      createDetectResult({
        frameIndex: 7,
        tsMs: 1_000,
        keypoints2D: [
          { name: 'leftShoulder', x: 10, y: 20, score: 0.98 },
          { name: 'rightShoulder', x: 30, y: 20, score: 0.97 }
        ],
        keypoints3D: [
          { name: 'leftShoulder', x: 1, y: 2, z: 3, score: 0.98 },
          { name: 'rightShoulder', x: 4, y: 5, z: 6, score: 0.97 },
          { name: 'leftElbow', x: 7, y: 8, z: 9, score: 0.96 }
        ],
        angleFrame: {
          tsMs: 1_000,
          angles: {
            leftElbow: 1.1,
            rightShoulder: 1.2,
            leftHip: 1.3
          },
          bodyRotationRad: 0.4
        }
      }),
      createDetectResult({
        frameIndex: 11,
        tsMs: 1_085,
        keypoints3D: [
          { name: 'leftShoulder', x: 11, y: 12, z: 13, score: 0.93 },
          { name: 'rightShoulder', x: 14, y: 15, z: 16, score: 0.92 },
          { name: 'leftHip', x: 17, y: 18, z: 19, score: 0.91 },
          { name: 'rightHip', x: 20, y: 21, z: 22, score: 0.9 }
        ]
      })
    ])

    expect(sequence.landmark_names).toEqual([
      'left_shoulder',
      'right_shoulder',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
      'left_ankle',
      'right_ankle'
    ])

    expect(sequence.angle_names).toEqual([
      'left_elbow',
      'right_elbow',
      'left_shoulder',
      'right_shoulder',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
      'torso_rotation'
    ])

    expect(sequence.frames).toEqual([
      {
        frame_index: 7,
        time: 0,
        landmarks_3d: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        landmark_visibility: [
          0.98,
          0.97,
          0.96,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        angles: [1.1, null, null, 1.2, 1.3, null, null, null, 0.4]
      },
      {
        frame_index: 11,
        time: 0.085,
        landmarks_3d: [
          [11, 12, 13],
          [14, 15, 16],
          null,
          null,
          null,
          null,
          [17, 18, 19],
          [20, 21, 22],
          null,
          null,
          null,
          null
        ],
        landmark_visibility: [
          0.93,
          0.92,
          null,
          null,
          null,
          null,
          0.91,
          0.9,
          null,
          null,
          null,
          null
        ]
      }
    ])
  })

  it('keeps frame times monotonic from real timestamps even when frame indexes skip', () => {
    const sequence = buildStandardPoseSequence([
      createDetectResult({
        frameIndex: 3,
        tsMs: 5_000,
        keypoints3D: [{ name: 'leftShoulder', x: 1, y: 1, z: 1, score: 0.8 }]
      }),
      createDetectResult({
        frameIndex: 8,
        tsMs: 5_041,
        keypoints3D: [{ name: 'leftShoulder', x: 2, y: 2, z: 2, score: 0.8 }]
      }),
      createDetectResult({
        frameIndex: 15,
        tsMs: 5_120,
        keypoints3D: [{ name: 'leftShoulder', x: 3, y: 3, z: 3, score: 0.8 }]
      })
    ])

    expect(sequence.frames.map(frame => frame.frame_index)).toEqual([3, 8, 15])
    expect(sequence.frames.map(frame => frame.time)).toEqual([0, 0.041, 0.12])
  })
})
