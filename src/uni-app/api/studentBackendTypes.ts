import type { CheckpointKey, StudentProfile, TrainingModality } from '../../types/student'
import type { GrowthCalendarDay } from '../../domain/student/growth'
import type { PhysicalMetricTrend } from '../../domain/student/types'
import type { ScoredActionResult } from '../../domain/training/actionScoringTypes'

export type BackendExerciseType = 'MARTIAL_ARTS' | 'HIIT' | 'STAIRS'
export type BackendQuestionType = 'SINGLE' | 'MULTIPLE' | 'TEXT'
export type VisualPoseAngleName =
  | 'left_elbow'
  | 'right_elbow'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'torso_rotation'

export interface UserUpdatePayload {
  name?: string
  gender?: 1 | 2
  student_id?: string
  major?: string
  height?: number
  weight?: number
  age?: number | null
  grade?: string | null
  resting_heart_rate?: number | null
}

export interface BackendCurrentUser {
  id: number
  name: string | null
  gender: 1 | 2 | null
  student_id: string | null
  major: string | null
  height: number | string | null
  weight: number | string | null
  age?: number | null
  grade?: string | null
  resting_heart_rate?: number | null
  [key: string]: unknown
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
  source_order?: number
  dimension?: string
  response_config?: Record<string, unknown>
  scoring_config?: Record<string, unknown>
  order: number
  options: BackendQuestionOption[]
}

export interface BackendPsychologyScale {
  id: number
  code?: string | null
  title: string
  short_title?: string
  description: string
  instructions?: string
  response_legend?: Array<{ value: number; label: string }>
  scoring_config?: Record<string, unknown>
  estimated_minutes?: number
  checkpoint?: CheckpointKey
  order: number
  created_at: string
  questions: BackendScaleQuestion[]
}

export interface BackendPsychologyScaleSummary {
  id: number
  code?: string | null
  title: string
  short_title?: string
  checkpoint?: CheckpointKey
  order: number
}

export interface BackendQuestionnairePlan {
  checkpoint: CheckpointKey
  questionnaire_count: number
  completed_questionnaire_count: number
  estimated_total_minutes: number
  current_questionnaire_id: number | null
  questionnaires: Array<{
    id: number
    code: string | null
    title: string
    short_title: string
    order: number
    estimated_minutes: number
    question_count: number
    completed: boolean
  }>
}

export interface BackendPsychologyRecord {
  id: number
  total_score: number | string | null
  percentage?: number | string | null
  analysis: string
  completed_at: string
  scale_info: BackendPsychologyScaleSummary | BackendPsychologyScale
}

export interface PsychologyScaleSubmitPayload {
  scale_id: number
  answers: {
    question_id: number
    selected_options: number[]
    text_answer?: string
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
  questionType?: BackendQuestionType
  sourceOrder?: number
  dimension?: string
  responseConfig?: Record<string, unknown>
  options: PsychologyQuestionnaireOption[]
}

export interface PsychologyQuestionnaireModel {
  scaleId: number
  title: string
  shortTitle?: string
  description: string
  instructions?: string
  responseLegend?: Array<{ value: number; label: string }>
  estimatedMinutes?: number
  checkpoint: CheckpointKey
  questions: PsychologyQuestionnaireQuestion[]
}

export type PsychologyQuestionnaireAnswer = number | number[] | string

export interface LongQuestionnaireSyncInput {
  checkpoint: CheckpointKey
  scaleId: number
  answers: Record<number, PsychologyQuestionnaireAnswer>
  title: string
}

export interface VisualPoseAnalysisSequenceFrame {
  frame_index: number
  time: number
  values: Array<number | null>
}

export interface VisualPoseAnalysisPayload {
  schema_version: '0.1'
  sequence_id: string
  source: 'student'
  fps: number
  angle_unit: 'radian'
  angle_names: VisualPoseAngleName[]
  frames: VisualPoseAnalysisSequenceFrame[]
  scoringSource?: 'client'
  scoringVersion?: string
  actionScores?: ScoredActionResult[]
  scoringWarnings?: string[]
  scoreDetails?: ExerciseScoreDetails
}

export interface VisualSessionSyncInput {
  sessionId: string
  modality: Exclude<TrainingModality, 'stair'>
  durationSeconds: number
  videoId?: number
  score?: number
  scoreUnavailableReason?: string
  comment?: string
  poseAnalysis?: VisualPoseAnalysisPayload
  completedAt?: string
}

export interface StairSessionSummary {
  summaryText?: string
  estimatedStepCount?: number
  activeClimbSeconds?: number
  cadenceSpmAvg?: number
  cadenceSpmPeak?: number
  cadenceStability?: number
  estimatedVerticalSpeedMps?: number
  estimatedFloorsPerMin?: number
  pauseCount?: number
  confidence?: number
  calories?: number
}

export interface StairSessionSyncInput {
  sessionId: string
  durationSeconds: number
  completedIntervals: number
  qualityScore: number
  summary: string | StairSessionSummary
  completedAt?: string
}

export interface ExerciseVideoSummary {
  id: number
  title: string
  exercise_type: BackendExerciseType
  /** 标准动作视频文件 URL（可为 null，需用 resolveAbsoluteUrl 拼接完整地址） */
  video_file?: string | null
  /** 标准动作识别数据 URL */
  standard_data_url?: string | null
  /** 缩略图 URL */
  thumbnail?: string | null
  /** 视频描述 */
  description?: string
  /** 时长(秒) */
  duration?: number
  /** 难度等级 1-5 */
  difficulty?: number
  order?: number
  is_active?: boolean
  /** 动作讲解文本 */
  tutorial_text?: string
  /** 讲解视频 CDN 地址（为空时使用 video_file） */
  tutorial_video_url?: string | null
}

/** 用户训练记录摘要（用于讲解页参考训记） */
export interface ExerciseRecordBrief {
  id: number
  score: number | null
  comment: string
  status: string
  duration: number | null
  created_at: string
}

/** 动作讲解 API 响应 */
export interface TutorialResponse {
  video_id: number
  title: string
  description?: string
  tutorial_video_url: string | null
  tutorial_text: string
  standard_data_url: string | null
  duration: number
  exercise_type: string
  recent_records: ExerciseRecordBrief[]
}

export interface ExerciseArrangementSummary {
  id: number
  title: string
  description?: string
  exercise_type: BackendExerciseType
  item_count: number
  total_duration: number
  is_active: boolean
  order: number
}

/** Backend-authoritative TTS phases for one arrangement action. */
export type TrainingTtsPhase = 'PRETRAINING' | 'FORMAL' | 'REST'
export type TrainingTtsTiming =
  | 'START'
  | 'AFTER_OFFSET'
  | 'BEFORE_END'
  | 'BEFORE_COUNTDOWN'
  | 'COMPLETE'

export interface TrainingTtsCue {
  id: number
  phase: TrainingTtsPhase
  timing: TrainingTtsTiming
  offset_seconds: number
  text: string
  audio_url: string
  /** A migrated legacy rest track contains its own full 3/2/1 sequence. */
  includes_embedded_countdown?: boolean
  order: number
}

export interface TrainingCountdownTtsCue {
  seconds_remaining: 1 | 2 | 3
  text: string
  audio_url: string
}

export interface ExerciseArrangementItem {
  id: number
  video_id: number
  video: ExerciseVideoSummary
  /** `NONE` skips pretraining; `FULL` replays the complete action video first. */
  pretraining_mode: 'NONE' | 'FULL'
  /** Countdown immediately before the optional pretraining module. */
  pretraining_countdown_duration: number
  /** The duration of the mandatory formal-training module. */
  expected_duration: number
  /** Countdown immediately before the mandatory formal-training module. */
  formal_countdown_duration: number
  /** Rest after this action's formal-training module. */
  rest_duration: number
  /** Countdown displayed inside the final part of the rest window. */
  rest_countdown_duration: number
  /** Legacy API field retained by Django during the client rollout; never used for flow control. */
  countdown_duration?: number
  /** Published, phase-scoped speech. The client never falls back to action-standard JSON TTS. */
  training_tts_cues?: TrainingTtsCue[]
  standard_data_url?: string | null
  order: number
}

export interface ExerciseArrangementDetail extends ExerciseArrangementSummary {
  items: ExerciseArrangementItem[]
  /** Globally configured 3/2/1 audio shared by each module countdown. */
  countdown_tts_cues?: TrainingCountdownTtsCue[]
}

export interface ExerciseScoreDimension {
  key: string
  label: string
  score: number
}

export interface ExerciseScoreRadarPoint {
  key: string
  label: string
  score: number
}

export interface ExerciseScoreChartSnapshot {
  radar?: ExerciseScoreRadarPoint[]
}

export interface ExerciseScoreDetails {
  overallScore: number
  summary: string
  dimensions: ExerciseScoreDimension[]
  highlights: string[]
  warnings: string[]
  chartSnapshot?: ExerciseScoreChartSnapshot
}

export interface BackendExerciseRecord {
  id: number
  training_session_id?: string
  video?: number
  duration: number
  score: number | string | null
  score_status?: 'SCORED' | 'UNAVAILABLE'
  score_unavailable_reason?: string
  comment: string
  poseAnalysis?: VisualPoseAnalysisPayload & {
    scoreDetails?: ExerciseScoreDetails
  }
  scoreDetails?: ExerciseScoreDetails | null
  status?: string
  created_at: string
  completed_at?: string | null
  received_at?: string | null
  completion_time_source?: 'CLIENT' | 'SERVER' | null
  video_info?: {
    id: number
    title: string
    exercise_type: BackendExerciseType
  }
}

export interface BackendStairRecord {
  id: number
  training_session_id?: string
  duration: number
  speed_data: Record<string, unknown> | null
  acceleration_data: Record<string, unknown> | null
  created_at: string
  completed_at?: string | null
  received_at?: string | null
  completion_time_source?: 'CLIENT' | 'SERVER' | null
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

export interface BackendExerciseScoreTrendPoint {
  recordId: number
  date: string
  overallScore: number
}

export interface BackendExerciseScoreTrendDimension {
  key: string
  label: string
  values: number[]
}

export interface BackendExerciseScoreTrendResponse {
  trend: BackendExerciseScoreTrendPoint[]
  dimensions: BackendExerciseScoreTrendDimension[]
  summary: {
    sessionCount: number
    latestOverallScore: number
    bestOverallScore: number
  }
}

export interface ExerciseRecordCreatePayload {
  video: number
  duration: number
  training_session_id: string
  score?: number
  score_unavailable_reason?: string
  comment?: string
  poseAnalysis?: VisualPoseAnalysisPayload
  client_completed_at?: string
}

export interface StairsRecordCreatePayload {
  duration: number
  training_session_id: string
  speed_data: Record<string, unknown> | null
  acceleration_data: Record<string, unknown> | null
  steps_count: number | null
  calories: number | null
  client_completed_at?: string
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

export interface ShortQuestionnaireSyncInput {
  sessionId: string
  energyLevel: number
  confidence: number
  enjoyment: number
}

export interface ShortQuestionnaireCreatePayload {
  training_session_id: string
  energy_level: number
  confidence: number
  enjoyment: number
}

export interface BackendShortQuestionnaireRecord {
  id: number
  user: number
  training_session_id: string
  energy_level: number
  confidence: number
  enjoyment: number
  created_at: string
  updated_at: string
}

export type ShortQuestionnaireSyncResult =
  | { synced: true }
  | { synced: false, reason: 'pending-backend-endpoint' | 'network-error' }

export interface GrowthTrainingHistoryItem {
  id: string
  modality: TrainingModality
  date: string
  summary: string
  qualityScore: number | null
  scoreDetails?: ExerciseScoreDetails | null
}

export interface GrowthVisualScoreTrendModel {
  trend: BackendExerciseScoreTrendPoint[]
  dimensions: BackendExerciseScoreTrendDimension[]
  summary: BackendExerciseScoreTrendResponse['summary']
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
  updateProfile: (payload: UserUpdatePayload) => Promise<unknown>
  createSurveyRecord: (payload: SurveyRecordCreatePayload) => Promise<unknown>
  listExerciseVideos: (exerciseType: BackendExerciseType) => Promise<ExerciseVideoSummary[]>
  listExerciseArrangements: (
    exerciseType: BackendExerciseType
  ) => Promise<ExerciseArrangementSummary[]>
  getExerciseArrangement: (id: number) => Promise<ExerciseArrangementDetail>
  getExerciseVideoTutorial: (videoId: number) => Promise<TutorialResponse>
  createExerciseRecord: (payload: ExerciseRecordCreatePayload) => Promise<BackendExerciseRecord>
  getExerciseScoreTrend: () => Promise<BackendExerciseScoreTrendResponse>
  createStairsRecord: (payload: StairsRecordCreatePayload) => Promise<unknown>
  listPsychologyScales: () => Promise<BackendPsychologyScale[]>
  getPsychologyQuestionnairePlan?: (
    checkpoint: CheckpointKey
  ) => Promise<BackendQuestionnairePlan>
  getNextPsychologyScale: () => Promise<BackendPsychologyScale | { message: string }>
  submitPsychologyScale: (payload: PsychologyScaleSubmitPayload) => Promise<PsychologyScaleSubmitResponse>
  listPsychologyRecords: () => Promise<BackendPsychologyRecord[]>
  listExerciseRecords: () => Promise<BackendExerciseRecord[]>
  listStairRecords: () => Promise<BackendStairRecord[]>
  getPhysicalTestTrend: () => Promise<BackendPhysicalTrendResponse>
  getMyCompliance: () => Promise<BackendComplianceSummary>
  getComplianceCalendar: (year: number, month: number) => Promise<BackendComplianceCalendar>
  getComplianceTrend: (count: number) => Promise<BackendComplianceTrend>
  getTrainingProgress: () => Promise<BackendTrainingProgress>
  getAchievementAwards?: () => Promise<BackendAchievementAwards>
  listNotifications: () => Promise<BackendStationNotification[]>
  getUnreadNotifications: () => Promise<BackendUnreadNotifications>
  markNotificationRead: (id: number) => Promise<unknown>
  resolveReminderReturn: (payload: BackendReminderReturnPayload) => Promise<BackendReminderReturn>
  submitShortQuestionnaire?: (
    payload: ShortQuestionnaireCreatePayload
  ) => Promise<BackendShortQuestionnaireRecord>
}

export interface BackendStationNotification {
  id: number
  notification_type: 'TRAINING_REMINDER' | 'SCALE_REMINDER' | 'ACHIEVEMENT' | 'SYSTEM'
  title: string
  content: string
  is_read: boolean
  reminder_slot: '12:00' | '18:00' | null
  action_target: string
  created_at: string
}

export interface BackendUnreadNotifications {
  count: number
  notifications: BackendStationNotification[]
}

export interface BackendReminderReturnPayload {
  tracking_id: string
  slot: '12:00' | '18:00'
  local_date: string
}

export interface BackendReminderReturn {
  resolved: true
  slot: '12:00' | '18:00'
  local_date: string
  first_returned_at: string
}

export type BackendTrainingModality = 'MARTIAL_ARTS' | 'HIIT' | 'STAIRS'

export interface BackendTrainingProgress {
  date: string
  modalities: Array<{
    modality: BackendTrainingModality
    completed: boolean
  }>
  distinct_daily_count: number
  daily_goal_completed: boolean
  week: {
    start_date: string
    end_date: string
    qualifying_day_count: number
  }
}

export interface BackendAchievementMilestone {
  code: 'starter' | 'momentum' | 'assessment'
  earned: boolean
  awarded_at: string | null
}

export interface BackendSessionBadgeAward {
  code: 'session_platinum' | 'session_gold' | 'session_silver' | 'session_bronze'
  training_session_id: string
  modality: BackendTrainingModality
  local_date: string
  score: number
  awarded_at: string
}

export interface BackendAchievementAwards {
  milestones: BackendAchievementMilestone[]
  session_badges: BackendSessionBadgeAward[]
}

export type RegistrationSyncInput = StudentProfile
export type GrowthPhysicalMetrics = PhysicalMetricTrend[]

// ---------------------------------------------------------------------------
// Compliance / Adherence types
// ---------------------------------------------------------------------------

export interface BackendComplianceSummary {
  today_count: number
  today_completed: boolean
  total_training_days: number
  completed_days: number
  compliance_rate: number
}

export interface BackendComplianceCalendarDay {
  date: string
  day: number
  weekday: number
  training_count: number
  is_completed: boolean
}

export interface BackendComplianceCalendar {
  year: number
  month: number
  days: BackendComplianceCalendarDay[]
  completed_days: number
  total_training_count: number
}

export interface BackendComplianceTrendPoint {
  period: string
  label: string
  start_date: string
  end_date: string
  training_days: number
  total_count: number
  completed_days: number
  completion_rate: number
}

export interface BackendComplianceTrend {
  type: 'weekly'
  trend: BackendComplianceTrendPoint[]
}

export interface StudentAdherenceTrendPoint {
  period: string
  label: string
  trainingDays: number
  totalCount: number
  completedDays: number
  completionRate: number
}

export interface StudentAdherenceData {
  todayCount: number
  todayCompleted: boolean
  totalTrainingDays: number
  completedDays: number
  complianceRate: number
  calendar: GrowthCalendarDay[]
  trend: StudentAdherenceTrendPoint[]
}
