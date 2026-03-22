import type { CheckpointKey, StudentAppState } from './types'

const CHECKPOINT_ORDER: CheckpointKey[] = ['baseline', 'week4', 'week8', 'week12']

function normalizeActiveCheckpoint(activeCheckpoint: CheckpointKey): CheckpointKey {
  const activeIndex = CHECKPOINT_ORDER.indexOf(activeCheckpoint)
  return activeIndex >= 0 ? activeCheckpoint : 'baseline'
}

export type AccessStateSource = {
  profile: Readonly<StudentAppState['profile']>
  longQuestionnaires: Readonly<StudentAppState['longQuestionnaires']>
  activeCheckpoint: StudentAppState['activeCheckpoint']
}

export function resolveEntryRoute(state: AccessStateSource): string {
  if (!state.profile.completed) {
    return '/register'
  }

  const activeCheckpoint = normalizeActiveCheckpoint(state.activeCheckpoint)
  if (!state.longQuestionnaires[activeCheckpoint].completed) {
    return `/questionnaires/${activeCheckpoint}`
  }

  return '/home'
}
