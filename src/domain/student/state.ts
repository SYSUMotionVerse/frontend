import type {
  CheckpointKey,
  PhysicalMetricTrend,
  SessionAnalysis,
  SessionRecord,
  StudentAppState,
  StudentProfile,
  TrainingModality
} from './types'
import { resolveEntryRoute } from './access'
import { cloneStudentValue } from './clone'
import { completeGuidedSession, evaluateReminderEligibility } from './training'

const EMPTY_PROFILE: StudentProfile = {
  studentId: '',
  name: '',
  gender: '',
  age: 18,
  major: '',
  grade: '',
  heightCm: 0,
  weightKg: 0,
  restingHeartRate: 0,
  completed: false
}

const createDailyAdherence = () => ({
  date: new Date().toISOString().slice(0, 10),
  validCheckIns: 0,
  rawSessions: 0,
  reminderEligible: false,
  goalReached: false
})

const createWeeklyAdherence = () => ({
  qualifyingDays: 0,
  achieved: false
})

const createPhysicalMetrics = (): PhysicalMetricTrend[] => []

function cloneState(state: StudentAppState) {
  return cloneStudentValue(state)
}

export function createInitialStudentState(): StudentAppState {
  return {
    profile: { ...EMPTY_PROFILE },
    longQuestionnaires: {
      baseline: {
        checkpoint: 'baseline',
        completed: false,
        score: null,
        percentage: null,
        submittedAt: null
      },
      week4: {
        checkpoint: 'week4',
        completed: false,
        score: null,
        percentage: null,
        submittedAt: null
      },
      week8: {
        checkpoint: 'week8',
        completed: false,
        score: null,
        percentage: null,
        submittedAt: null
      },
      week12: {
        checkpoint: 'week12',
        completed: false,
        score: null,
        percentage: null,
        submittedAt: null
      }
    },
    sessions: [],
    dailyAdherence: createDailyAdherence(),
    weeklyAdherence: createWeeklyAdherence(),
    physicalMetrics: createPhysicalMetrics(),
    activeCheckpoint: 'baseline',
    reminderSource: null
  }
}

export function createStudentStateSnapshot(state: StudentAppState): StudentAppState {
  return cloneState(state)
}

export function completeStudentProfile(state: StudentAppState, profile: StudentProfile): StudentAppState {
  const nextState = cloneState(state)
  nextState.profile = {
    ...profile,
    completed: true
  }
  return nextState
}

export function setStudentActiveCheckpoint(
  state: StudentAppState,
  checkpoint: CheckpointKey
): StudentAppState {
  const nextState = cloneState(state)
  nextState.activeCheckpoint = checkpoint
  return nextState
}

export function setStudentReminderSource(
  state: StudentAppState,
  source: StudentAppState['reminderSource']
): StudentAppState {
  const nextState = cloneState(state)
  nextState.reminderSource = source
  return nextState
}

export function replaceStudentSessions(
  state: StudentAppState,
  sessions: SessionRecord[]
): StudentAppState {
  const nextState = cloneState(state)
  nextState.sessions = sessions
  return nextState
}

export function submitStudentLongQuestionnaire(
  state: StudentAppState,
  checkpoint: CheckpointKey,
  score: number,
  percentage: number
): StudentAppState {
  const nextState = cloneState(state)
  const questionnaire = nextState.longQuestionnaires[checkpoint]
  questionnaire.completed = true
  questionnaire.score = score
  questionnaire.percentage = percentage
  questionnaire.submittedAt = new Date().toISOString()
  return nextState
}

export function completeStudentTrainingSession(
  state: StudentAppState,
  input: {
    modality: TrainingModality
    qualityScore: number
    summary: string
    capturedBy: SessionAnalysis['capturedBy']
  }
): StudentAppState {
  return completeGuidedSession(state, input)
}

export function refreshStudentReminderEligibility(state: StudentAppState): StudentAppState {
  return evaluateReminderEligibility(state)
}

export function setStudentPhysicalMetrics(
  state: StudentAppState,
  metrics: PhysicalMetricTrend[]
): StudentAppState {
  const nextState = cloneState(state)
  nextState.physicalMetrics = metrics
  return nextState
}

export function submitShortQuestionnaireForLatestStudentSession(
  state: StudentAppState,
  payload: {
    energyLevel: number
    confidence: number
    enjoyment: number
  }
): StudentAppState {
  const nextState = cloneState(state)
  const latestSession = nextState.sessions.at(-1)

  if (!latestSession) {
    return nextState
  }

  latestSession.shortQuestionnaire = {
    submitted: true,
    ...payload
  }

  return nextState
}

export function resolveStudentNextPage(state: StudentAppState): string {
  return resolveEntryRoute(state)
}
