import { readonly, shallowRef } from 'vue'
import {
  type TrainingProgressViewModel
} from '../../features/training/progress'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import { studentBackendSync } from '../api/studentBackend'
import { mapTrainingProgress } from '../api/trainingProgressModels'
import { createRequestCache } from './useRequestCache'

export type TrainingProgressState =
  | { status: 'loading' }
  | { status: 'ready'; progress: TrainingProgressViewModel }
  | { status: 'error'; message: string }

const state = shallowRef<TrainingProgressState>({ status: 'loading' })
const progressCache = createRequestCache({
  ttlMs: 60_000,
  async load() {
    await studentBackendSync.retryPendingTrainingSubmissions()
    const dto = await studentBackendSync.loadTrainingProgress()
    if (dto === null) {
      throw new Error('Backend training progress is disabled.')
    }
    return mapTrainingProgress(dto)
  }
})

export function useTrainingProgress() {

  async function refresh(options: { force?: boolean } = {}) {
    const hasReadyData = state.value.status === 'ready'
    if (!options.force && hasReadyData && progressCache.hasValue()) {
      return
    }
    if (!hasReadyData) state.value = { status: 'loading' }
    try {
      const progress = await progressCache.get(options)
      state.value = {
        status: 'ready',
        progress
      }
    } catch (error) {
      reportBackendSyncError('训练进度同步', error)
      state.value = {
        status: 'error',
        message: '今日训练进度暂时无法同步，请稍后重试。'
      }
    }
  }

  return {
    state: readonly(state),
    refresh,
    invalidate: progressCache.invalidate
  }
}
