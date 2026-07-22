import type { Pose } from '../../../subpackages/training/components/pose/PoseDetectModel'

export const DEFAULT_POSE_ANGLE_CONFIDENCE_THRESHOLD = 0.5

export const POSE_ANGLE_KEYS = [
  'leftKnee',
  'leftHip',
  'leftShoulder',
  'leftElbow',
  'rightKnee',
  'rightHip',
  'rightShoulder',
  'rightElbow'
] as const

export type PoseAngleKey = (typeof POSE_ANGLE_KEYS)[number]

export interface PoseAngleFrame {
  tsMs: number
  angles: Partial<Record<PoseAngleKey, number>>
  bodyRotationRad?: number
}

type PosePoint2D = NonNullable<Pose['keypoints'][number]>
type PosePoint3D = NonNullable<NonNullable<Pose['keypoints3D']>[number]>
type PosePoint3DWithDepth = PosePoint3D & { z: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buildKeypointMap(points: Array<{ name?: string } | undefined> | undefined) {
  return new Map(
    (points ?? [])
      .filter((point): point is { name: string } & Record<string, unknown> => typeof point?.name === 'string')
      .flatMap(point => {
        const camelCaseName = point.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
        return camelCaseName === point.name
          ? [[point.name, point] as const]
          : [[point.name, point] as const, [camelCaseName, point] as const]
      })
  )
}

function resolveScore(
  name: string,
  keypoints2D: Map<string, PosePoint2D>,
  keypoints3D: Map<string, PosePoint3D>
) {
  const score = keypoints2D.get(name)?.score ?? keypoints3D.get(name)?.score
  return typeof score === 'number' ? score : 0
}

function resolve2DPoint(name: string, keypoints2D: Map<string, PosePoint2D>) {
  return keypoints2D.get(name)
}

function resolve3DPoint(name: string, keypoints3D: Map<string, PosePoint3D>): PosePoint3DWithDepth | null {
  const point = keypoints3D.get(name)
  if (!point || typeof point.z !== 'number') {
    return null
  }

  return point as PosePoint3DWithDepth
}

function angleBetween(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
  c: { x: number; y: number; z?: number }
) {
  const abx = a.x - b.x
  const aby = a.y - b.y
  const abz = (a.z ?? 0) - (b.z ?? 0)
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const cbz = (c.z ?? 0) - (b.z ?? 0)

  const abMagnitude = Math.hypot(abx, aby, abz)
  const cbMagnitude = Math.hypot(cbx, cby, cbz)
  if (abMagnitude === 0 || cbMagnitude === 0) {
    return null
  }

  const dot = abx * cbx + aby * cby + abz * cbz
  return Math.acos(clamp(dot / (abMagnitude * cbMagnitude), -1, 1))
}

function resolveJointAngle(
  names: [string, string, string],
  minConfidence: number,
  keypoints2D: Map<string, PosePoint2D>,
  keypoints3D: Map<string, PosePoint3D>
) {
  const scores = names.map(name => resolveScore(name, keypoints2D, keypoints3D))
  if (scores.some(score => score < minConfidence)) {
    return undefined
  }

  const points3D = names.map(name => resolve3DPoint(name, keypoints3D))
  if (points3D.every(point => point !== null)) {
    return angleBetween(points3D[0], points3D[1], points3D[2])
  }

  const points2D = names.map(name => resolve2DPoint(name, keypoints2D))
  if (points2D.some(point => !point)) {
    return undefined
  }

  return angleBetween(points2D[0]!, points2D[1]!, points2D[2]!)
}

function resolveBodyRotationRad(
  minConfidence: number,
  keypoints2D: Map<string, PosePoint2D>,
  keypoints3D: Map<string, PosePoint3D>
) {
  const candidates: Array<{ radians: number; weight: number }> = []

  const addCandidate = (leftName: string, rightName: string) => {
    const left = resolve3DPoint(leftName, keypoints3D)
    const right = resolve3DPoint(rightName, keypoints3D)
    const confidence = Math.min(
      resolveScore(leftName, keypoints2D, keypoints3D),
      resolveScore(rightName, keypoints2D, keypoints3D)
    )

    if (!left || !right || confidence < minConfidence) {
      return
    }

    candidates.push({
      // Sign convention for downstream JSON/export:
      // positive => torso turns counterclockwise
      // negative => torso turns clockwise
      // Keep near-front torso rotation anchored around 0 even when the
      // left/right pair is mirrored in image coordinates.
      radians: Math.atan2(right.z - left.z, Math.abs(right.x - left.x)),
      weight: confidence
    })
  }

  addCandidate('leftShoulder', 'rightShoulder')
  addCandidate('leftHip', 'rightHip')

  if (candidates.length === 0) {
    return undefined
  }

  const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) {
    return undefined
  }

  const x = candidates.reduce((sum, item) => sum + Math.cos(item.radians) * item.weight, 0)
  const y = candidates.reduce((sum, item) => sum + Math.sin(item.radians) * item.weight, 0)

  return Math.atan2(y, x)
}

export function buildPoseAngleFrame(
  pose: Pose,
  tsMs: number,
  minConfidence = DEFAULT_POSE_ANGLE_CONFIDENCE_THRESHOLD
): PoseAngleFrame | null {
  const keypoints2D = buildKeypointMap(pose.keypoints) as Map<string, PosePoint2D>
  const keypoints3D = buildKeypointMap(pose.keypoints3D) as Map<string, PosePoint3D>

  const angles: Partial<Record<PoseAngleKey, number>> = {}

  const joints: Record<PoseAngleKey, [string, string, string]> = {
    leftKnee: ['leftHip', 'leftKnee', 'leftAnkle'],
    leftHip: ['leftShoulder', 'leftHip', 'leftKnee'],
    leftShoulder: ['leftElbow', 'leftShoulder', 'leftHip'],
    leftElbow: ['leftShoulder', 'leftElbow', 'leftWrist'],
    rightKnee: ['rightHip', 'rightKnee', 'rightAnkle'],
    rightHip: ['rightShoulder', 'rightHip', 'rightKnee'],
    rightShoulder: ['rightElbow', 'rightShoulder', 'rightHip'],
    rightElbow: ['rightShoulder', 'rightElbow', 'rightWrist']
  }

  for (const jointName of POSE_ANGLE_KEYS) {
    const radians = resolveJointAngle(joints[jointName], minConfidence, keypoints2D, keypoints3D)
    if (typeof radians === 'number' && Number.isFinite(radians)) {
      angles[jointName] = radians
    }
  }

  const bodyRotationRad = resolveBodyRotationRad(minConfidence, keypoints2D, keypoints3D)

  if (Object.keys(angles).length === 0 && bodyRotationRad === undefined) {
    return null
  }

  return {
    tsMs,
    angles,
    ...(bodyRotationRad === undefined ? {} : { bodyRotationRad })
  }
}
