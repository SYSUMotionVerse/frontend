import type { DetectResult, Pose } from './PoseDetectModel'

export const STANDARD_POSE_LANDMARK_NAMES = [
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
] as const

export const STANDARD_POSE_ANGLE_NAMES = [
  'left_elbow',
  'right_elbow',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'torso_rotation'
] as const

type StandardPoseLandmarkName = (typeof STANDARD_POSE_LANDMARK_NAMES)[number]
type StandardPoseAngleName = (typeof STANDARD_POSE_ANGLE_NAMES)[number]
type PoseKeypoint2D = NonNullable<Pose['keypoints'][number]>
type PoseKeypoint3D = NonNullable<NonNullable<Pose['keypoints3D']>[number]>

export interface StandardPoseSequenceFrame {
  frame_index: number
  time: number
  landmarks_3d: Array<[number, number, number] | null>
  landmark_visibility?: Array<number | null>
  angles?: Array<number | null>
}

export interface StandardPoseSequence {
  landmark_names: StandardPoseLandmarkName[]
  angle_names: StandardPoseAngleName[]
  frames: StandardPoseSequenceFrame[]
}

const landmarkNameMap: Record<StandardPoseLandmarkName, string> = {
  left_shoulder: 'leftShoulder',
  right_shoulder: 'rightShoulder',
  left_elbow: 'leftElbow',
  right_elbow: 'rightElbow',
  left_wrist: 'leftWrist',
  right_wrist: 'rightWrist',
  left_hip: 'leftHip',
  right_hip: 'rightHip',
  left_knee: 'leftKnee',
  right_knee: 'rightKnee',
  left_ankle: 'leftAnkle',
  right_ankle: 'rightAnkle'
}

const angleValueResolvers = [
  (result: DetectResult) => result.angleFrame?.angles.leftElbow ?? null,
  (result: DetectResult) => result.angleFrame?.angles.rightElbow ?? null,
  (result: DetectResult) => result.angleFrame?.angles.leftShoulder ?? null,
  (result: DetectResult) => result.angleFrame?.angles.rightShoulder ?? null,
  (result: DetectResult) => result.angleFrame?.angles.leftHip ?? null,
  (result: DetectResult) => result.angleFrame?.angles.rightHip ?? null,
  (result: DetectResult) => result.angleFrame?.angles.leftKnee ?? null,
  (result: DetectResult) => result.angleFrame?.angles.rightKnee ?? null,
  (result: DetectResult) => result.angleFrame?.bodyRotationRad ?? null
] as const

function toPointMap<T extends { name?: string }>(points: T[] | undefined) {
  return new Map(
    (points ?? [])
      .filter((point): point is T & { name: string } => typeof point?.name === 'string')
      .map(point => [point.name, point])
  )
}

function roundSeconds(value: number) {
  return Number(value.toFixed(3))
}

function resolveVisibility(
  name: string,
  keypoints2D: Map<string, PoseKeypoint2D>,
  keypoints3D: Map<string, PoseKeypoint3D>
) {
  const score = keypoints3D.get(name)?.score ?? keypoints2D.get(name)?.score
  return typeof score === 'number' ? score : null
}

export function buildStandardPoseSequence(results: DetectResult[]): StandardPoseSequence {
  if (results.length === 0) {
    return {
      landmark_names: [...STANDARD_POSE_LANDMARK_NAMES],
      angle_names: [...STANDARD_POSE_ANGLE_NAMES],
      frames: []
    }
  }

  const firstTsMs = results[0].tsMs

  return {
    landmark_names: [...STANDARD_POSE_LANDMARK_NAMES],
    angle_names: [...STANDARD_POSE_ANGLE_NAMES],
    frames: results.map((result, index) => {
      const keypoints2D = toPointMap(result.pose.keypoints)
      const keypoints3D = toPointMap(result.pose.keypoints3D)

      const landmarks3D = STANDARD_POSE_LANDMARK_NAMES.map(name => {
        const point = keypoints3D.get(landmarkNameMap[name])
        if (!point || typeof point.z !== 'number') {
          return null
        }

        return [point.x, point.y, point.z] as [number, number, number]
      })

      const landmarkVisibility = STANDARD_POSE_LANDMARK_NAMES.map(name =>
        resolveVisibility(landmarkNameMap[name], keypoints2D, keypoints3D)
      )

      const angles = angleValueResolvers.map(resolveAngle => resolveAngle(result))

      return {
        frame_index: result.frameIndex ?? index,
        time: roundSeconds((result.tsMs - firstTsMs) / 1000),
        landmarks_3d: landmarks3D,
        ...(landmarkVisibility.some(value => value !== null)
          ? { landmark_visibility: landmarkVisibility }
          : {}),
        ...(angles.some(value => value !== null) ? { angles } : {})
      }
    })
  }
}
