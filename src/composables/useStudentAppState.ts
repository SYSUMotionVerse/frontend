import { computed, reactive, readonly } from 'vue'
import { createInitialStudentState } from '../domain/student/state'
import { useStudentStore } from '../uni-app/composables/useStudentStore'

export { createInitialStudentState } from '../domain/student/state'

export function resetStudentState() {
  useStudentStore().reset()
}

export function useStudentAppState() {
  const store = useStudentStore()
  const pendingCheckpoint = computed(() => {
    const snapshot = store.getSnapshot()
    const active = snapshot.longQuestionnaires[snapshot.activeCheckpoint]
    return active.completed ? null : active.checkpoint
  })

  return {
    state: store.state,
    pendingCheckpoint,
    completeProfile: store.completeProfile,
    setActiveCheckpoint: store.setActiveCheckpoint,
    setReminderSource: store.setReminderSource,
    replaceSessions: store.replaceSessions,
    submitLongQuestionnaire: store.submitLongQuestionnaire,
    completeTrainingSession: store.completeTrainingSession,
    refreshReminderEligibility: store.refreshReminderEligibility,
    setPhysicalMetrics: store.setPhysicalMetrics,
    submitShortQuestionnaireForLatestSession: store.submitShortQuestionnaireForLatestSession,
    resetStudentState
  }
}
