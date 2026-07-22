import type { Pose } from '../../subpackages/training/components/pose/PoseDetectModel'

export type ActionType = 'repetitive' | 'hold' | 'single'
export type QueueStatus = 'pending' | 'analyzing' | 'ready' | 'error'

export interface TtsCue {
  time: number
  text: string
}

export interface AngleRule {
  enabled: boolean
  weight: number
  tolerance: number
  feedback: {
    too_small: string
    too_large: string
  }
}

export interface ActionStandardFile {
  schema_version: '0.4'
  action_id: string
  action_name: string
  action_type: ActionType
  fps: number
  angle_unit: 'radian'
  angle_names: string[]
  standard_sequence: number[][]
  angle_rules: Record<string, AngleRule>
  tts_cues: TtsCue[]
  metadata: {
    created_by: string
    created_at: string
    note: string
    preprocessing_info: {
      source_schema_version: '0.3'
      target_fps: number
      smoothing_enabled: boolean
      smoothing_target: 'landmarks'
      smoothing_method: 'moving_average'
      smoothing_window: number
      generated_from_landmarks: boolean
    }
  }
}

export interface RawPoseSample {
  time: number
  pose: Pose | null
}

export interface ActionVideoItem {
  id: string
  file: File
  objectUrl: string
  duration: number
  trimStart: number
  trimEnd: number
  actionId: string
  actionName: string
  actionType: ActionType
  createdBy: string
  note: string
  ttsCues: TtsCue[]
  status: QueueStatus
  progress: number
  detectedFrames: number
  totalFrames: number
  error: string
  output: ActionStandardFile | null
}
