import { cloneStudentValue } from './clone'
import type { SessionAnalysis, StudentAppState, TrainingModality } from './types'

export interface CompletionInput {
  modality: TrainingModality
  qualityScore: number
  summary: string
  capturedBy: SessionAnalysis['capturedBy']
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
  const nextValidCheckIns = Math.min(3, nextState.dailyAdherence.validCheckIns + 1)
  const validCheckInApplied = nextState.dailyAdherence.validCheckIns < 3

  nextState.sessions.push({
    id: `session-${sessionNumber}`,
    modality: input.modality,
    date: nextState.dailyAdherence.date,
    completed: true,
    validCheckInApplied,
    restartedAfterInterrupt: false,
    shortQuestionnaire: null,
    analysis: {
      qualityScore: input.qualityScore,
      summary: input.summary,
      capturedBy: input.capturedBy
    }
  })

  nextState.dailyAdherence.rawSessions += 1
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
