export type CheckpointKey = 'baseline' | 'week4' | 'week8' | 'week12'

export type TrainingModality = 'wushu' | 'hiit' | 'stair'

export interface StudentProfile {
  studentId: string
  name: string
  gender: string
  age: number
  major: string
  grade: string
  heightCm: number
  weightKg: number
  restingHeartRate: number
  completed: boolean
}

export interface LongQuestionnaireState {
  checkpoint: CheckpointKey
  completed: boolean
  score: number | null
  percentage: number | null
  submittedAt: string | null
}

export interface ShortQuestionnaireState {
  submitted: boolean
  energyLevel: number
  confidence: number
  enjoyment: number
}

export interface SessionAnalysis {
  qualityScore: number
  summary: string
  capturedBy: 'camera' | 'sensor'
}

export interface SessionRecord {
  id: string
  modality: TrainingModality
  date: string
  completed: boolean
  validCheckInApplied: boolean
  restartedAfterInterrupt: boolean
  shortQuestionnaire: ShortQuestionnaireState | null
  analysis: SessionAnalysis
}

export interface DailyAdherenceState {
  date: string
  validCheckIns: number
  rawSessions: number
  reminderEligible: boolean
  goalReached: boolean
}

export interface WeeklyAdherenceState {
  qualifyingDays: number
  achieved: boolean
}

export interface PhysicalMetricTrend {
  label: string
  values: readonly number[]
  unit: string
}

export interface StudentAppState {
  profile: StudentProfile
  longQuestionnaires: Record<CheckpointKey, LongQuestionnaireState>
  sessions: SessionRecord[]
  dailyAdherence: DailyAdherenceState
  weeklyAdherence: WeeklyAdherenceState
  physicalMetrics: PhysicalMetricTrend[]
  activeCheckpoint: CheckpointKey
  reminderSource: 'manual' | 'wechat-reminder' | null
}
