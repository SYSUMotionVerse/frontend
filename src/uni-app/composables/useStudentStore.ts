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
  modality: TrainingModality
  qualityScore: number
  summary: string
  capturedBy: SessionAnalysis['capturedBy']
}

export function createStudentStore(initialState: StudentAppState = createInitialStudentState()) {
  const state = reactive(createStudentStateSnapshot(initialState))

  function getSnapshot() {
    return createStudentStateSnapshot(toRaw(state) as StudentAppState)
  }

  function completeProfile(profile: StudentProfile) {
    Object.assign(state, completeStudentProfile(getSnapshot(), profile))
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
    energyLevel: number
    confidence: number
    enjoyment: number
  }) {
    Object.assign(state, submitShortQuestionnaireForLatestStudentSession(getSnapshot(), payload))
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
    setActiveCheckpoint,
    setReminderSource,
    replaceSessions,
    submitLongQuestionnaire,
    completeTrainingSession,
    refreshReminderEligibility,
    setPhysicalMetrics,
    submitShortQuestionnaireForLatestSession,
    reset,
    getSnapshot,
    resolveNextPage
  }
}

const studentStore = createStudentStore()

export function useStudentStore() {
  return studentStore
}
