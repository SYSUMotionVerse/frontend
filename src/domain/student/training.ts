import { cloneStudentValue } from './clone'
import type { SessionAnalysis, StudentAppState, TrainingModality } from './types'
import { toShanghaiDate } from './shanghaiTime'

export interface CompletionInput {
  sessionId?: string
  modality: TrainingModality
  qualityScore: number | null
  summary: string
  capturedBy: SessionAnalysis['capturedBy']
  completedAt?: string
  countsAsCompletion?: boolean
  scoreDetails?: SessionAnalysis['scoreDetails']
}

function cloneState(state: StudentAppState) {
  return cloneStudentValue(state)
}

export function startTrainingDay(state: StudentAppState, date: string): StudentAppState {
  const nextState = cloneState(state)
  nextState.dailyAdherence.date = date
  nextState.dailyAdherence.validCheckIns = 0
  nextState.dailyAdherence.rawSessions = 0
  nextState.dailyAdherence.goalReached = false
  nextState.dailyAdherence.reminderEligible = true
  return nextState
}

export function completeGuidedSession(state: StudentAppState, input: CompletionInput): StudentAppState {
  const nextState = cloneState(state)
  const sessionNumber = nextState.sessions.length + 1
  const countsAsCompletion = input.countsAsCompletion ?? true
  const nextValidCheckIns = countsAsCompletion
    ? Math.min(3, nextState.dailyAdherence.validCheckIns + 1)
    : nextState.dailyAdherence.validCheckIns
  const validCheckInApplied = countsAsCompletion && nextState.dailyAdherence.validCheckIns < 3
  const completedDate = input.completedAt
    ? toShanghaiDate(input.completedAt) || nextState.dailyAdherence.date
    : nextState.dailyAdherence.date

  nextState.sessions.push({
    id: input.sessionId ?? `session-${sessionNumber}`,
    modality: input.modality,
    date: completedDate,
    completed: true,
    validCheckInApplied,
    restartedAfterInterrupt: false,
    shortQuestionnaire: null,
    analysis: {
      qualityScore: input.qualityScore,
      summary: input.summary,
      capturedBy: input.capturedBy,
      ...(input.scoreDetails !== undefined ? { scoreDetails: input.scoreDetails } : {})
    }
  })

  if (countsAsCompletion) nextState.dailyAdherence.rawSessions += 1
  nextState.dailyAdherence.validCheckIns = nextValidCheckIns
  nextState.dailyAdherence.goalReached = nextValidCheckIns >= 3
  nextState.dailyAdherence.reminderEligible = nextValidCheckIns < 3

  const qualifyingDays = countQualifyingDays(nextState.sessions)
  nextState.weeklyAdherence.qualifyingDays = qualifyingDays
  nextState.weeklyAdherence.achieved = qualifyingDays >= 3

  return nextState
}

export function evaluateReminderEligibility(state: StudentAppState): StudentAppState {
  const nextState = cloneState(state)
  nextState.dailyAdherence.reminderEligible = nextState.dailyAdherence.validCheckIns < 3
  return nextState
}

function countQualifyingDays(sessions: StudentAppState['sessions']): number {
  const validCheckInsByDate = sessions.reduce<Record<string, number>>((accumulator, session) => {
    if (!session.validCheckInApplied) {
      return accumulator
    }

    accumulator[session.date] = (accumulator[session.date] ?? 0) + 1
    return accumulator
  }, {})

  return Object.values(validCheckInsByDate).filter(count => count >= 3).length
}
