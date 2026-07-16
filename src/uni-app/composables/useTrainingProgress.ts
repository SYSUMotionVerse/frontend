import { readonly, shallowRef } from 'vue'
import {
  type TrainingProgressViewModel
} from '../../features/training/progress'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import { studentBackendSync } from '../api/studentBackend'
import { mapTrainingProgress } from '../api/trainingProgressModels'

export type TrainingProgressState =
  | { status: 'loading' }
  | { status: 'ready'; progress: TrainingProgressViewModel }
  | { status: 'error'; message: string }

export function useTrainingProgress() {
  const state = shallowRef<TrainingProgressState>({ status: 'loading' })

  async function refresh() {
    state.value = { status: 'loading' }
    try {
      await studentBackendSync.retryPendingTrainingSubmissions()
      const dto = await studentBackendSync.loadTrainingProgress()
      if (dto === null) {
        throw new Error('Backend training progress is disabled.')
      }
      state.value = {
        status: 'ready',
        progress: mapTrainingProgress(dto)
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
    refresh
  }
}
