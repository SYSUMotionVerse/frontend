import { reactive, readonly, toRaw } from 'vue'
import {
  completeStudentProfile,
  completeStudentTrainingSession,
  createInitialStudentState,
  createStudentStateSnapshot,
  refreshStudentReminderEligibility,
  replaceStudentSessions,
  resolveStudentNextPage,
  setStudentActiveCheckpoint,
  setStudentPhysicalMetrics,
  setStudentReminderSource,
  submitShortQuestionnaireForStudentSession,
  submitShortQuestionnaireForLatestStudentSession,
  submitStudentLongQuestionnaire
} from '../../domain/student/state'
import type {
  CheckpointKey,
  PhysicalMetricTrend,
  SessionAnalysis,
  SessionRecord,
  StudentAppState,
  StudentProfile,
  TrainingModality
} from '../../domain/student/types'

type TrainingSessionInput = {
  sessionId?: string
  modality: TrainingModality
  qualityScore: number | null
  summary: string
  capturedBy: SessionAnalysis['capturedBy']
  completedAt?: string
  countsAsCompletion?: boolean
  scoreDetails?: SessionAnalysis['scoreDetails']
}

export type StudentAccessHydrationInput = {
  profile: StudentProfile
  completedQuestionnaireCheckpoints: CheckpointKey[]
  activeCheckpoint: CheckpointKey
}

export function createStudentStore(initialState: StudentAppState = createInitialStudentState()) {
  const state = reactive(createStudentStateSnapshot(initialState))

  function getSnapshot() {
    return createStudentStateSnapshot(toRaw(state) as StudentAppState)
  }

  function completeProfile(profile: StudentProfile) {
    Object.assign(state, completeStudentProfile(getSnapshot(), profile))
  }

  function hydrateAccessState(input: StudentAccessHydrationInput) {
    const nextState = getSnapshot()
    nextState.profile = { ...input.profile }
    nextState.activeCheckpoint = input.activeCheckpoint
    const completedCheckpoints = new Set(input.completedQuestionnaireCheckpoints)

    for (const checkpoint of Object.keys(nextState.longQuestionnaires) as CheckpointKey[]) {
      const questionnaire = nextState.longQuestionnaires[checkpoint]
      questionnaire.completed = completedCheckpoints.has(checkpoint)
      if (!questionnaire.completed) {
        questionnaire.score = null
        questionnaire.percentage = null
        questionnaire.submittedAt = null
      }
    }

    Object.assign(state, nextState)
  }

  function setActiveCheckpoint(checkpoint: CheckpointKey) {
    Object.assign(state, setStudentActiveCheckpoint(getSnapshot(), checkpoint))
  }

  function setReminderSource(source: StudentAppState['reminderSource']) {
    Object.assign(state, setStudentReminderSource(getSnapshot(), source))
  }

  function replaceSessions(sessions: SessionRecord[]) {
    Object.assign(state, replaceStudentSessions(getSnapshot(), sessions))
  }

  function submitLongQuestionnaire(checkpoint: CheckpointKey, score: number, percentage: number) {
    Object.assign(state, submitStudentLongQuestionnaire(getSnapshot(), checkpoint, score, percentage))
  }

  function completeTrainingSession(input: TrainingSessionInput) {
    Object.assign(state, completeStudentTrainingSession(getSnapshot(), input))
  }

  function refreshReminderEligibility() {
    Object.assign(state, refreshStudentReminderEligibility(getSnapshot()))
  }

  function setPhysicalMetrics(metrics: PhysicalMetricTrend[]) {
    Object.assign(state, setStudentPhysicalMetrics(getSnapshot(), metrics))
  }

  function submitShortQuestionnaireForLatestSession(payload: {
    feelingScale: number
    feltArousalScale: number
  }) {
    Object.assign(state, submitShortQuestionnaireForLatestStudentSession(getSnapshot(), payload))
  }

  function submitShortQuestionnaireForSession(
    sessionId: string,
    payload: {
      feelingScale: number
      feltArousalScale: number
    }
  ) {
    Object.assign(state, submitShortQuestionnaireForStudentSession(getSnapshot(), sessionId, payload))
  }

  function reset() {
    Object.assign(state, createInitialStudentState())
  }

  function resolveNextPage() {
    return resolveStudentNextPage(getSnapshot())
  }

  return {
    state: readonly(state),
    completeProfile,
    hydrateAccessState,
    setActiveCheckpoint,
    setReminderSource,
    replaceSessions,
    submitLongQuestionnaire,
    completeTrainingSession,
    refreshReminderEligibility,
    setPhysicalMetrics,
    submitShortQuestionnaireForLatestSession,
    submitShortQuestionnaireForSession,
    reset,
    getSnapshot,
    resolveNextPage
  }
}

const studentStore = createStudentStore()

export function useStudentStore() {
  return studentStore
}
