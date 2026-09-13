import type { ScoredActionResult } from '../domain/training/actionScoringTypes'

export type CheckpointKey = 'baseline' | 'daily' | 'week4' | 'week8' | 'week12'

export type EducationLevel = '本科生' | '研究生' | '博士生'

export type TrainingModality = 'wushu' | 'hiit' | 'stair'

export interface StudentProfile {
  studentId: string
  name: string
  gender: string
  age: number
  major: string
  grade: string
  college?: string
  educationLevel?: EducationLevel | ''
  heightCm: number
  weightKg: number
  /** Legacy field retained only for reading older locally cached profiles. */
  restingHeartRate?: number
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
  feelingScale: number
  feltArousalScale: number
}

export interface SessionAnalysis {
  qualityScore: number | null
  summary: string
  capturedBy: 'camera' | 'sensor'
  scoreDetails?: SessionScoreDetails | null
}

export interface SessionScoreDetails {
  overallScore: number
  summary: string
  dimensions: Array<{ key: string, label: string, score: number }>
  highlights: string[]
  warnings: string[]
  actionResults?: ScoredActionResult[]
  chartSnapshot?: {
    radar?: Array<{ key: string, label: string, score: number }>
  }
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
  values: readonly (number | null)[]
  unit: string
  before?: number | null
  after?: number | null
  change?: number | null
  changePercent?: number | null
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
