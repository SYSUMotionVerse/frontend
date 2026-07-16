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
  let inFlightResolution: Promise<void> | null = null

  function capture(query: Record<string, string | undefined>) {
    pendingTarget = parseReminderReturnQuery(query)
    state.value = pendingTarget ? { status: 'pending' } : { status: 'idle' }
  }

  function resolvePending() {
    if (inFlightResolution) {
      return inFlightResolution
    }

    const target = pendingTarget
    if (!target) {
      return Promise.resolve()
    }

    state.value = { status: 'resolving' }
    inFlightResolution = (async () => {
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
      } finally {
        inFlightResolution = null
      }
    })()

    return inFlightResolution
  }

  return {
    state: readonly(state),
    capture,
    resolvePending
  }
}
