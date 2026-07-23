import { buildPoseAngleFrame } from '../../uni-app/components/pose/poseAnalysis'
import {
  STANDARD_POSE_ANGLE_NAMES,
  STANDARD_POSE_LANDMARK_NAMES
} from '../../uni-app/components/pose/standardPoseSequence'
import type { ActionExportFile, ActionVideoItem, RawPoseSample } from './types'

const landmarkNameMap = Object.fromEntries(
  STANDARD_POSE_LANDMARK_NAMES.map(name => [name, name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())])
) as Record<string, string>

function buildPointMap(points: PosePoint[] | undefined) {
  return new Map(
    (points ?? [])
      .filter((point): point is PosePoint & { name: string } => typeof point.name === 'string')
      .flatMap(point => {
        const camelCaseName = point.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
        return camelCaseName === point.name
          ? [[point.name, point] as const]
          : [[point.name, point] as const, [camelCaseName, point] as const]
      })
  )
}

type PosePoint = {
  x: number
  y: number
  score?: number
  name?: string
}

function roundTime(value: number) {
  return Number(value.toFixed(3))
}

function buildFrame(sample: RawPoseSample, frameIndex: number, firstTime: number) {
  const keypoints = buildPointMap(sample.pose?.keypoints)
  const angleFrame = sample.pose
    ? buildPoseAngleFrame(sample.pose, Math.round(sample.time * 1000))
    : null

  return {
    frame_index: frameIndex,
    time: roundTime(sample.time - firstTime),
    landmarks_2d: STANDARD_POSE_LANDMARK_NAMES.map(name => {
      const point = keypoints.get(landmarkNameMap[name])
      return point ? [point.x, point.y] as [number, number] : null
    }),
    landmark_visibility: STANDARD_POSE_LANDMARK_NAMES.map(name => {
      const score = keypoints.get(landmarkNameMap[name])?.score
      return typeof score === 'number' ? score : null
    }),
    angles: [
      angleFrame?.angles.leftElbow ?? null,
      angleFrame?.angles.rightElbow ?? null,
      angleFrame?.angles.leftShoulder ?? null,
      angleFrame?.angles.rightShoulder ?? null,
      angleFrame?.angles.leftHip ?? null,
      angleFrame?.angles.rightHip ?? null,
      angleFrame?.angles.leftKnee ?? null,
      angleFrame?.angles.rightKnee ?? null,
      angleFrame?.bodyRotationRad ?? null
    ]
  }
}

export function buildActionExportFile(
  item: Pick<ActionVideoItem, 'actionName' | 'note' | 'file'>,
  samples: RawPoseSample[],
  options: { exportedBy: string; sourceFps: number; exportedAt?: string }
): ActionExportFile {
  if (samples.length === 0) throw new Error('视频没有可导出的帧')

  const firstTime = samples[0].time
  return {
    schema_version: '0.5',
    action_name: item.actionName.trim(),
    landmark_names: [...STANDARD_POSE_LANDMARK_NAMES],
    angle_names: [...STANDARD_POSE_ANGLE_NAMES],
    frames: samples.map((sample, index) => buildFrame(sample, index, firstTime)),
    metadata: {
      exported_by: options.exportedBy.trim(),
      exported_at: options.exportedAt ?? new Date().toISOString(),
      source_video: item.file.name,
      source_fps: options.sourceFps,
      note: item.note.trim()
    }
  }
}

export function safeJsonFilename(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_')
  return `${normalized || 'action-export'}.json`
}

export function createUniqueJsonFilenames(actionNames: string[]) {
  const counts = new Map<string, number>()
  return actionNames.map(actionName => {
    const filename = safeJsonFilename(actionName)
    const count = counts.get(filename) ?? 0
    counts.set(filename, count + 1)
    return count === 0
      ? filename
      : filename.replace(/\.json$/, `-${count + 1}.json`)
  })
}
