import type { CheckpointKey, StudentProfile, TrainingModality } from '../../types/student'
import type { PhysicalMetricTrend } from '../../domain/student/types'

export type BackendExerciseType = 'MARTIAL_ARTS' | 'HIIT' | 'STAIRS'
export type BackendQuestionType = 'SINGLE' | 'MULTIPLE' | 'TEXT'

export interface UserUpdatePayload {
  name?: string
  gender?: 1 | 2
  student_id?: string
  major?: string
  height?: number
  weight?: number
  avatar?: string
}

export interface BackendCurrentUser {
  id: number
  name: string | null
  gender: 1 | 2 | null
  student_id: string | null
  major: string | null
  height: number | string | null
  weight: number | string | null
  avatar?: string | null
  [key: string]: unknown
}

export interface AvatarUploadResult {
  avatarUrl: string
}

export interface ProfileAvatarSyncResult {
  avatarUrl: string
  profile: StudentProfile
}

export interface SurveyRecordCreatePayload {
  survey_type: 1 | 2
  score?: number
  analysis: string
}

export interface BackendQuestionOption {
  id: number
  option_text: string
  score: number
  order: number
}

export interface BackendScaleQuestion {
  id: number
  question_text: string
  question_type: BackendQuestionType
  order: number
  options: BackendQuestionOption[]
}

export interface BackendPsychologyScale {
  id: number
  title: string
  description: string
  order: number
  created_at: string
  questions: BackendScaleQuestion[]
}

export interface BackendPsychologyRecord {
  id: number
  total_score: number | string | null
  analysis: string
  completed_at: string
  scale_info: BackendPsychologyScale
}

export interface PsychologyScaleSubmitPayload {
  scale_id: number
  answers: {
    question_id: number
    selected_options: number[]
  }[]
}

export interface PsychologyScaleSubmitResponse {
  message?: string
  record: BackendPsychologyRecord
}

export interface PsychologyQuestionnaireOption {
  id: number
  label: string
  score: number
}

export interface PsychologyQuestionnaireQuestion {
  id: number
  prompt: string
  options: PsychologyQuestionnaireOption[]
}

export interface PsychologyQuestionnaireModel {
  scaleId: number
  title: string
  description: string
  checkpoint: CheckpointKey
  questions: PsychologyQuestionnaireQuestion[]
}

export interface LongQuestionnaireSyncInput {
  checkpoint: CheckpointKey
  scaleId: number
  answers: Record<number, number>
  title: string
}

export interface VisualSessionSyncInput {
  modality: Exclude<TrainingModality, 'stair'>
  durationSeconds: number
}

export interface StairSessionSyncInput {
  durationSeconds: number
  completedIntervals: number
  qualityScore: number
  summary: string
}

export interface ExerciseVideoSummary {
  id: number
  title: string
  exercise_type: BackendExerciseType
}

export interface BackendExerciseRecord {
  id: number
  video?: number
  duration: number
  score: number | string | null
  comment: string
  status?: string
  created_at: string
  video_info?: {
    id: number
    title: string
    exercise_type: BackendExerciseType
  }
}

export interface BackendStairRecord {
  id: number
  duration: number
  speed_data: Record<string, unknown> | null
  acceleration_data: Record<string, unknown> | null
  created_at: string
}

export interface BackendPhysicalTrendEntry {
  test_round: number
  test_date: string
  bmi: number | null
  body_fat_rate: number | null
  vital_capacity: number | null
  fifty_meter_run: number | null
  standing_long_jump: number | null
  sit_and_reach: number | null
  one_minute_sit_ups: number | null
  pull_ups: number | null
  eight_hundred_meter_run: number | null
  thousand_meter_run: number | null
  grip_strength: number | null
}

export interface BackendPhysicalTrendResponse {
  trend: BackendPhysicalTrendEntry[]
  total_tests: number
}

export interface ExerciseRecordCreatePayload {
  video: number
  duration: number
}

export interface StairsRecordCreatePayload {
  duration: number
  speed_data: Record<string, unknown> | null
  acceleration_data: Record<string, unknown> | null
  steps_count: number | null
  calories: number | null
}

export interface BackendSyncResult {
  synced: boolean
  reason?: 'disabled'
}

export interface VisualSessionSyncResult extends BackendSyncResult {
  record?: BackendExerciseRecord
}

export interface LongQuestionnaireSyncResult extends BackendSyncResult {
  score?: number
  percentage?: number
  analysis?: string
  submittedAt?: string
}

export interface GrowthTrainingHistoryItem {
  id: string
  modality: TrainingModality
  date: string
  summary: string
  qualityScore: number
}

export interface GrowthAssessmentHistoryItem {
  checkpoint: CheckpointKey
  title: string
  score: number
  percentage: number
  submittedAt: string | null
}

export interface StudentBackendSyncDependencies {
  isEnabled: () => boolean
  ensureSession: () => Promise<void>
  getCurrentUser: () => Promise<BackendCurrentUser>
  uploadAvatar: (
    filePath: string,
    source: StudentProfile['avatarSource']
  ) => Promise<AvatarUploadResult>
  updateProfile: (payload: UserUpdatePayload) => Promise<unknown>
  createSurveyRecord: (payload: SurveyRecordCreatePayload) => Promise<unknown>
  listExerciseVideos: (exerciseType: BackendExerciseType) => Promise<ExerciseVideoSummary[]>
  createExerciseRecord: (payload: ExerciseRecordCreatePayload) => Promise<BackendExerciseRecord>
  createStairsRecord: (payload: StairsRecordCreatePayload) => Promise<unknown>
  listPsychologyScales: () => Promise<BackendPsychologyScale[]>
  getNextPsychologyScale: () => Promise<BackendPsychologyScale | { message: string }>
  submitPsychologyScale: (payload: PsychologyScaleSubmitPayload) => Promise<PsychologyScaleSubmitResponse>
  listPsychologyRecords: () => Promise<BackendPsychologyRecord[]>
  listExerciseRecords: () => Promise<BackendExerciseRecord[]>
  listStairRecords: () => Promise<BackendStairRecord[]>
  getPhysicalTestTrend: () => Promise<BackendPhysicalTrendResponse>
}

export type RegistrationSyncInput = StudentProfile
export type GrowthPhysicalMetrics = PhysicalMetricTrend[]
