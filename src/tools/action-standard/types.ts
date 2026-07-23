import type { Pose } from '../../subpackages/training/components/pose/PoseDetectModel'

export type QueueStatus = 'pending' | 'analyzing' | 'ready' | 'error'

export interface ActionExportFrame {
  frame_index: number
  time: number
  landmarks_2d: Array<[number, number] | null>
  landmark_visibility: Array<number | null>
  angles: Array<number | null>
}

export interface ActionExportFile {
  schema_version: '0.5'
  action_name: string
  landmark_names: string[]
  angle_names: string[]
  frames: ActionExportFrame[]
  metadata: {
    exported_by: string
    exported_at: string
    source_video: string
    source_fps: number
    note: string
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
  actionName: string
  note: string
  status: QueueStatus
  progress: number
  detectedFrames: number
  totalFrames: number
  error: string
  output: ActionExportFile | null
}
