import { computed, readonly, shallowRef } from 'vue'
import { createBackendClient } from '../api/backendClient'
import {
  requestReminderAuthorization,
  type ReminderAuthorizationConfig,
  type ReminderAuthorizationResult,
  type ReminderAuthorizationStatus,
  type ReminderFailedOperation,
  type ReminderGrant,
  type ReminderSyncState
} from '../platform/reminderConsent'

type ReminderConsentDependencies = {
  requestAuthorization: (
    config?: ReminderAuthorizationConfig
  ) => Promise<ReminderAuthorizationResult>
  syncAuthorization: (status: ReminderAuthorizationStatus) => Promise<unknown>
  reportGrants: (grants: ReminderGrant[]) => Promise<unknown>
  loadAuthorization?: () => Promise<{ status: ReminderAuthorizationStatus }>
  loadAuthorizationConfig?: () => Promise<ReminderAuthorizationConfig>
}

export function createReminderConsent(dependencies: ReminderConsentDependencies) {
  const status = shallowRef<ReminderAuthorizationStatus>('not_requested')
  const syncState = shallowRef<ReminderSyncState>('idle')
  const failedOperation = shallowRef<ReminderFailedOperation>(null)
  const pendingResult = shallowRef<ReminderAuthorizationStatus | null>(null)
  const isWorking = shallowRef(false)
  const topUpInFlight = shallowRef(false)

  const canRetrySync = computed(() => failedOperation.value !== null)

  async function syncPendingResult(result: ReminderAuthorizationStatus) {
    syncState.value = 'syncing'
    try {
      await dependencies.syncAuthorization(result)
      syncState.value = 'synced'
      pendingResult.value = null
      failedOperation.value = null
    } catch {
      syncState.value = 'failed'
      pendingResult.value = result
      failedOperation.value = 'sync_result'
    }
  }

  async function syncGrants(grants: ReminderGrant[]) {
    if (grants.length === 0) return
    try {
      await dependencies.reportGrants(grants)
    } catch {
      // Quota bookkeeping is best-effort: a failed report never blocks the
      // user-facing flow, and the next successful call replenishes credits.
    }
  }

  async function authorize() {
    isWorking.value = true
    failedOperation.value = null
    try {
      let config: ReminderAuthorizationConfig | undefined
      try {
        config = dependencies.loadAuthorizationConfig
          ? await dependencies.loadAuthorizationConfig()
          : undefined
      } catch {
        syncState.value = 'failed'
        failedOperation.value = 'load_config'
        pendingResult.value = null
        return
      }

      const result = await dependencies.requestAuthorization(config)
      status.value = result.status
      pendingResult.value = result.status
      await syncGrants(result.grants)
      await syncPendingResult(result.status)
    } finally {
      isWorking.value = false
    }
  }

  /**
   * Silently top up one-time subscription credits.
   *
   * Intended to be attached to high-frequency user actions such as starting a
   * training session. When the participant previously ticked “always keep my
   * choice” in the WeChat subscription panel the call resolves without showing
   * the dialog; each accepted template adds one send credit on the server.
   * The function never throws and never blocks the calling interaction.
   */
  async function topUpQuota() {
    if (topUpInFlight.value || isWorking.value) return
    if (status.value === 'banned' || status.value === 'unconfigured' || status.value === 'unsupported') {
      return
    }
    topUpInFlight.value = true
    try {
      let config: ReminderAuthorizationConfig | undefined
      try {
        config = dependencies.loadAuthorizationConfig
          ? await dependencies.loadAuthorizationConfig()
          : undefined
      } catch {
        return
      }
      const result = await dependencies.requestAuthorization(config)
      if (result.status !== 'not_requested') {
        status.value = result.status
      }
      await syncGrants(result.grants)
    } catch {
      // A platform failure must not reject a detached button action.
    } finally {
      topUpInFlight.value = false
    }
  }

  async function decline() {
    status.value = 'rejected'
    pendingResult.value = 'rejected'
    await syncPendingResult('rejected')
  }

  async function retryFailedOperation() {
    if (failedOperation.value === 'load_config') {
      await authorize()
      return
    }

    if (failedOperation.value === 'sync_result' && pendingResult.value) {
      await syncPendingResult(pendingResult.value)
    }
  }

  async function loadStatus() {
    if (!dependencies.loadAuthorization) {
      return
    }

    try {
      const persisted = await dependencies.loadAuthorization()
      status.value = persisted.status
      syncState.value = 'synced'
    } catch {
      syncState.value = 'failed'
    }
  }

  return {
    status: readonly(status),
    syncState: readonly(syncState),
    failedOperation: readonly(failedOperation),
    pendingResult: readonly(pendingResult),
    isWorking: readonly(isWorking),
    canRetrySync,
    authorize,
    decline,
    retryFailedOperation,
    loadStatus,
    topUpQuota
  }
}

export function useReminderConsent() {
  const backend = createBackendClient()

  return createReminderConsent({
    requestAuthorization: config => requestReminderAuthorization({
      templateIds: config?.template_ids ?? [],
      mode: config?.mode ?? 'test'
    }),
    async syncAuthorization(status) {
      await backend.ensureSession()
      await backend.updateReminderAuthorization(status)
    },
    async reportGrants(grants) {
      await backend.ensureSession()
      await backend.reportReminderSubscriptions(grants)
    },
    async loadAuthorization() {
      await backend.ensureSession()
      return backend.getReminderAuthorization()
    },
    async loadAuthorizationConfig() {
      await backend.ensureSession()
      return backend.getReminderAuthorization()
    }
  })
}
