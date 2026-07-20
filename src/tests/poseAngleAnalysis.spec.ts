import { describe, expect, it } from 'vitest'
import type { Pose } from '../subpackages/training/components/pose/PoseDetectModel'
import { buildPoseAngleFrame } from '../uni-app/components/pose/poseAnalysis'

function createPose(scoreOverrides: Partial<Record<string, number>> = {}): Pose {
  const baseScores: Record<string, number> = {
    leftShoulder: 0.99,
    rightShoulder: 0.99,
    leftElbow: 0.99,
    rightElbow: 0.99,
    leftWrist: 0.99,
    rightWrist: 0.99,
    leftHip: 0.99,
    rightHip: 0.99,
    leftKnee: 0.99,
    rightKnee: 0.99,
    leftAnkle: 0.99,
    rightAnkle: 0.99
  }

  const scores = {
    ...baseScores,
    ...scoreOverrides
  }

  return {
    keypoints: [
      { name: 'leftShoulder', x: -1, y: 2, score: scores.leftShoulder },
      { name: 'rightShoulder', x: 1, y: 2, score: scores.rightShoulder },
      { name: 'leftElbow', x: -2, y: 2, score: scores.leftElbow },
      { name: 'rightElbow', x: 2, y: 2, score: scores.rightElbow },
      { name: 'leftWrist', x: -2, y: 1, score: scores.leftWrist },
      { name: 'rightWrist', x: 2, y: 1, score: scores.rightWrist },
      { name: 'leftHip', x: -1, y: 0, score: scores.leftHip },
      { name: 'rightHip', x: 1, y: 0, score: scores.rightHip },
      { name: 'leftKnee', x: -1, y: -1, score: scores.leftKnee },
      { name: 'rightKnee', x: 1, y: -1, score: scores.rightKnee },
      { name: 'leftAnkle', x: -1, y: -2, score: scores.leftAnkle },
      { name: 'rightAnkle', x: 1, y: -2, score: scores.rightAnkle }
    ],
    keypoints3D: [
      { name: 'leftShoulder', x: -1, y: 2, z: -0.5, score: scores.leftShoulder },
      { name: 'rightShoulder', x: 1, y: 2, z: 0.5, score: scores.rightShoulder },
      { name: 'leftElbow', x: -2, y: 2, z: -0.5, score: scores.leftElbow },
      { name: 'rightElbow', x: 2, y: 2, z: 0.5, score: scores.rightElbow },
      { name: 'leftWrist', x: -2, y: 1, z: -0.5, score: scores.leftWrist },
      { name: 'rightWrist', x: 2, y: 1, z: 0.5, score: scores.rightWrist },
      { name: 'leftHip', x: -1, y: 0, z: -0.5, score: scores.leftHip },
      { name: 'rightHip', x: 1, y: 0, z: 0.5, score: scores.rightHip },
      { name: 'leftKnee', x: -1, y: -1, z: -0.5, score: scores.leftKnee },
      { name: 'rightKnee', x: 1, y: -1, z: 0.5, score: scores.rightKnee },
      { name: 'leftAnkle', x: -1, y: -2, z: -0.5, score: scores.leftAnkle },
      { name: 'rightAnkle', x: 1, y: -2, z: 0.5, score: scores.rightAnkle }
    ]
  }
}

function createTorsoRotationPose({
  shoulderDeltaZ,
  hipDeltaZ
}: {
  shoulderDeltaZ: number
  hipDeltaZ: number
}): Pose {
  return {
    keypoints: [
      { name: 'leftShoulder', x: -1, y: 2, score: 0.99 },
      { name: 'rightShoulder', x: 1, y: 2, score: 0.99 },
      { name: 'leftHip', x: -1, y: 0, score: 0.99 },
      { name: 'rightHip', x: 1, y: 0, score: 0.99 }
    ],
    keypoints3D: [
      { name: 'leftShoulder', x: -1, y: 2, z: -shoulderDeltaZ / 2, score: 0.99 },
      { name: 'rightShoulder', x: 1, y: 2, z: shoulderDeltaZ / 2, score: 0.99 },
      { name: 'leftHip', x: -1, y: 0, z: -hipDeltaZ / 2, score: 0.99 },
      { name: 'rightHip', x: 1, y: 0, z: hipDeltaZ / 2, score: 0.99 }
    ]
  }
}

describe('buildPoseAngleFrame', () => {
  it('returns a confidence-filtered angle frame with radians for the eight tracked joints', () => {
    const frame = buildPoseAngleFrame(createPose({ rightWrist: 0.2 }), 123, 0.5)

    expect(frame).not.toBeNull()
    expect(frame?.tsMs).toBe(123)
    expect(frame?.angles.leftElbow).toBeCloseTo(Math.PI / 2, 6)
    expect(frame?.angles.rightShoulder).toBeCloseTo(Math.PI / 2, 6)
    expect(frame?.angles.leftHip).toBeCloseTo(Math.PI, 6)
    expect(frame?.angles.rightKnee).toBeCloseTo(Math.PI, 6)
    expect(frame?.angles.rightElbow).toBeUndefined()
    expect(frame?.bodyRotationRad).toBeCloseTo(Math.atan2(1, 2), 6)
    expect(Object.keys(frame?.angles ?? {})).toEqual([
      'leftKnee',
      'leftHip',
      'leftShoulder',
      'leftElbow',
      'rightKnee',
      'rightHip',
      'rightShoulder'
    ])
  })

  it('keeps torso rotation near zero when mirrored shoulder and hip candidates straddle the wrap boundary', () => {
    const frame = buildPoseAngleFrame(
      {
        keypoints: [
          { name: 'leftShoulder', x: 0, y: 0, score: 0.99 },
          { name: 'rightShoulder', x: -1, y: 0, score: 0.99 },
          { name: 'leftHip', x: 0, y: -1, score: 0.99 },
          { name: 'rightHip', x: -1, y: -1, score: 0.99 }
        ],
        keypoints3D: [
          { name: 'leftShoulder', x: 0, y: 0, z: 0, score: 0.99 },
          { name: 'rightShoulder', x: -1, y: 0, z: 0.02, score: 0.99 },
          { name: 'leftHip', x: 0, y: -1, z: 0, score: 0.99 },
          { name: 'rightHip', x: -1, y: -1, z: -0.02, score: 0.99 }
        ]
      },
      789,
      0.5
    )

    expect(frame).not.toBeNull()
    expect(frame?.bodyRotationRad ?? 0).toBeCloseTo(0, 2)
  })

  it('uses positive torso rotation for counterclockwise turns and negative values for clockwise turns', () => {
    const counterclockwiseFrame = buildPoseAngleFrame(
      createTorsoRotationPose({
        shoulderDeltaZ: 1,
        hipDeltaZ: 0.5
      }),
      100,
      0.5
    )
    const clockwiseFrame = buildPoseAngleFrame(
      createTorsoRotationPose({
        shoulderDeltaZ: -1,
        hipDeltaZ: -0.5
      }),
      200,
      0.5
    )

    expect(counterclockwiseFrame?.bodyRotationRad).toBeGreaterThan(0)
    expect(clockwiseFrame?.bodyRotationRad).toBeLessThan(0)
  })

  it('returns null when no tracked angle survives the confidence threshold', () => {
    const frame = buildPoseAngleFrame(
      createPose({
        leftShoulder: 0.1,
        rightShoulder: 0.1,
        leftElbow: 0.1,
        rightElbow: 0.1,
        leftWrist: 0.1,
        rightWrist: 0.1,
        leftHip: 0.1,
        rightHip: 0.1,
        leftKnee: 0.1,
        rightKnee: 0.1,
        leftAnkle: 0.1,
        rightAnkle: 0.1
      }),
      456,
      0.5
    )

    expect(frame).toBeNull()
  })
})
