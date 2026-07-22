import { buildPoseAngleFrame } from '../../uni-app/components/pose/poseAnalysis'
import { STANDARD_POSE_ANGLE_NAMES } from '../../uni-app/components/pose/standardPoseSequence'
import type { ActionStandardFile, ActionVideoItem, AngleRule, RawPoseSample } from './types'

export const DEFAULT_FPS = 10
export const DEFAULT_SMOOTHING_WINDOW = 5
const DEFAULT_TOLERANCE_RAD = 20 * Math.PI / 180

const angleWeights = [1, 1, 2, 2, 2, 2, 1, 1, 2]
const totalWeight = angleWeights.reduce((sum, weight) => sum + weight, 0)

export function createDefaultAngleRules(): Record<string, AngleRule> {
  return Object.fromEntries(STANDARD_POSE_ANGLE_NAMES.map((name, index) => [name, {
    enabled: true,
    weight: angleWeights[index] / totalWeight,
    tolerance: DEFAULT_TOLERANCE_RAD,
    feedback: {
      too_small: '',
      too_large: ''
    }
  }]))
}

function valuesForSample(sample: RawPoseSample) {
  if (!sample.pose) return STANDARD_POSE_ANGLE_NAMES.map(() => null)
  const frame = buildPoseAngleFrame(sample.pose, Math.round(sample.time * 1000))
  if (!frame) return STANDARD_POSE_ANGLE_NAMES.map(() => null)

  return [
    frame.angles.leftElbow ?? null,
    frame.angles.rightElbow ?? null,
    frame.angles.leftShoulder ?? null,
    frame.angles.rightShoulder ?? null,
    frame.angles.leftHip ?? null,
    frame.angles.rightHip ?? null,
    frame.angles.leftKnee ?? null,
    frame.angles.rightKnee ?? null,
    frame.bodyRotationRad ?? null
  ]
}

function interpolateColumn(values: Array<number | null>) {
  const knownIndexes = values.flatMap((value, index) => value === null ? [] : [index])
  if (knownIndexes.length === 0) return null

  return values.map((value, index) => {
    if (value !== null) return value
    const previous = knownIndexes.findLast(knownIndex => knownIndex < index)
    const next = knownIndexes.find(knownIndex => knownIndex > index)
    if (previous === undefined) return values[next!]!
    if (next === undefined) return values[previous]!
    const ratio = (index - previous) / (next - previous)
    return values[previous]! + (values[next]! - values[previous]!) * ratio
  })
}

function movingAverage(values: number[], windowSize: number) {
  const radius = Math.floor(windowSize / 2)
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - radius), Math.min(values.length, index + radius + 1))
    return slice.reduce((sum, value) => sum + value, 0) / slice.length
  })
}

export function buildSmoothedAngleSequence(samples: RawPoseSample[], smoothingWindow = DEFAULT_SMOOTHING_WINDOW) {
  if (samples.length === 0) throw new Error('视频没有可分析的帧')
  const rawRows = samples.map(valuesForSample)
  const columns = STANDARD_POSE_ANGLE_NAMES.map((_, columnIndex) =>
    interpolateColumn(rawRows.map(row => row[columnIndex]))
  )
  const missingNames = columns.flatMap((column, index) => column ? [] : [STANDARD_POSE_ANGLE_NAMES[index]])
  if (missingNames.length > 0) {
    throw new Error(`以下角度在整段视频中均不可见：${missingNames.join('、')}`)
  }

  const smoothed = columns.map(column => movingAverage(column!, smoothingWindow))
  return samples.map((_, rowIndex) => smoothed.map(column => Number(column[rowIndex].toFixed(8))))
}

export function buildActionStandardFile(
  item: Pick<ActionVideoItem, 'actionId' | 'actionName' | 'actionType' | 'createdBy' | 'note' | 'ttsCues'>,
  samples: RawPoseSample[],
  options: { fps?: number; smoothingWindow?: number; createdAt?: string } = {}
): ActionStandardFile {
  const fps = options.fps ?? DEFAULT_FPS
  const smoothingWindow = options.smoothingWindow ?? DEFAULT_SMOOTHING_WINDOW
  return {
    schema_version: '0.4',
    action_id: item.actionId.trim(),
    action_name: item.actionName.trim(),
    action_type: item.actionType,
    fps,
    angle_unit: 'radian',
    angle_names: [...STANDARD_POSE_ANGLE_NAMES],
    standard_sequence: buildSmoothedAngleSequence(samples, smoothingWindow),
    angle_rules: createDefaultAngleRules(),
    tts_cues: item.ttsCues
      .filter(cue => cue.text.trim())
      .map(cue => ({ time: cue.time, text: cue.text.trim() }))
      .sort((a, b) => a.time - b.time),
    metadata: {
      created_by: item.createdBy.trim(),
      created_at: options.createdAt ?? new Date().toISOString(),
      note: item.note.trim(),
      preprocessing_info: {
        source_schema_version: '0.3',
        target_fps: fps,
        smoothing_enabled: true,
        smoothing_target: 'landmarks',
        smoothing_method: 'moving_average',
        smoothing_window: smoothingWindow,
        generated_from_landmarks: false
      }
    }
  }
}

export function safeJsonFilename(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_')
  return `${normalized || 'action'}.json`
}

export function validateTrimRange(trimStart: number, trimEnd: number, duration: number) {
  const durationTolerance = 0.01
  if (
    !Number.isFinite(trimStart)
    || !Number.isFinite(trimEnd)
    || !Number.isFinite(duration)
    || trimStart < 0
    || trimEnd > duration + durationTolerance
    || trimEnd <= trimStart
  ) return '截取时间范围无效'
  return ''
}
