export const ACTION_SCORING_VERSION = 'action-scoring-ts-v1'

export const ACTION_ANGLE_NAMES = [
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

export type ActionAngleName = (typeof ACTION_ANGLE_NAMES)[number]
export type ActionAlignmentMethod = 'resample' | 'dtw'
export type ActionScoreDirection = 'too_small' | 'too_large'

export interface ActionAngleRule {
  enabled: boolean
  weight?: number
  tolerance?: number
  feedback?: Partial<Record<ActionScoreDirection, string>>
}

export interface ActionTtsCue {
  time: number
  text: string
  audio_url: string
}

export type CountdownAudioUrls = Record<'1' | '2' | '3', string>

export interface ActionTransitionAudioUrls {
  start: string
  end: string
  next_action?: string
  rest_next_action?: string
}

export interface ActionStandard {
  schema_version?: string
  action_id: string
  action_name?: string
  action_type: 'repetitive'
  fps?: number
  angle_unit: 'radian'
  angle_names: string[]
  standard_sequence: Array<Array<number | null>>
  angle_rules: Partial<Record<ActionAngleName, ActionAngleRule>>
  tts_cues?: ActionTtsCue[]
  countdown_audio_url?: string
  countdown_audio_urls?: CountdownAudioUrls
  transition_audio_urls?: ActionTransitionAudioUrls
}

export interface ActionMotionFrame {
  frame_index?: number
  time?: number
  angles: Array<number | null>
}

export interface ActionMotion {
  angle_names: string[]
  frames: ActionMotionFrame[]
}

export interface ActionScoreFeedback {
  angle: ActionAngleName
  direction: ActionScoreDirection
  message: string
  severity: 'warning'
}

export interface ActionAngleScoreDetail {
  enabled: true
  weight: number
  normalized_weight: number
  score: number
  mean_error: number
  mean_signed_error: number
  max_error: number
  tolerance: number
  direction: ActionScoreDirection
  over_tolerance: boolean
}

export interface ActionScoreResult {
  score: number
  passed: boolean
  pass_score: number
  feedback: ActionScoreFeedback[]
  angle_details: Partial<Record<ActionAngleName, ActionAngleScoreDetail>>
  debug: {
    alignment_method: ActionAlignmentMethod
    input_source: 'angles'
    standard_frames: number
    user_frames: number
    used_angles: ActionAngleName[]
    warnings: string[]
    alignment_path_length?: number
    dtw_total_cost?: number
    dtw_mean_cost?: number
  }
}

export interface ScoredActionResult {
  itemId: number
  videoId: number
  actionId: string
  title: string
  expectedDuration: number
  score: number
  passed: boolean
  feedback: ActionScoreFeedback[]
  angleDetails: ActionScoreResult['angle_details']
  frameCount: number
}

export interface AggregatedActionScoreResult {
  score?: number
  summary: string
  dimensions: Array<{
    key: string
    label: string
    score: number
  }>
  highlights: string[]
  warnings: string[]
}
