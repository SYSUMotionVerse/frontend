import { readonly, shallowRef } from 'vue'
import { BackendRequestError } from '../api/backendClient'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import { studentBackendSync } from '../api/studentBackend'
import {
  parseReminderReturnQuery,
  type ReminderReturnTarget
} from '../platform/reminders'

export type ReminderReturnState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'resolving' }
  | { status: 'resolved' }
  | { status: 'rejected' }

export function useReminderReturn() {
  const state = shallowRef<ReminderReturnState>({ status: 'idle' })
  let pendingTarget: ReminderReturnTarget | null = null

  function capture(query: Record<string, string | undefined>) {
    pendingTarget = parseReminderReturnQuery(query)
    state.value = pendingTarget ? { status: 'pending' } : { status: 'idle' }
  }

  async function resolvePending() {
    const target = pendingTarget
    if (!target || state.value.status === 'resolving') {
      return
    }

    state.value = { status: 'resolving' }
    try {
      await studentBackendSync.resolveReminderReturn(target)
      pendingTarget = null
      state.value = { status: 'resolved' }
    } catch (error) {
      reportBackendSyncError('提醒回流同步', error)
      if (
        error instanceof BackendRequestError
        && (error.statusCode === 404 || error.statusCode === 410)
      ) {
        pendingTarget = null
        state.value = { status: 'rejected' }
        return
      }

      state.value = { status: 'pending' }
    }
  }

  return {
    state: readonly(state),
    capture,
    resolvePending
  }
}
