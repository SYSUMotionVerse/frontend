import { computed, readonly, shallowRef } from 'vue'
import { createBackendClient } from '../api/backendClient'
import {
  requestReminderAuthorization,
  type ReminderAuthorizationConfig,
  type ReminderAuthorizationStatus,
  type ReminderFailedOperation,
  type ReminderSyncState
} from '../platform/reminderConsent'

type ReminderConsentDependencies = {
  requestAuthorization: (
    config?: ReminderAuthorizationConfig
  ) => Promise<ReminderAuthorizationStatus>
  syncAuthorization: (status: ReminderAuthorizationStatus) => Promise<unknown>
  loadAuthorization?: () => Promise<{ status: ReminderAuthorizationStatus }>
  loadAuthorizationConfig?: () => Promise<ReminderAuthorizationConfig>
}

export function createReminderConsent(dependencies: ReminderConsentDependencies) {
  const status = shallowRef<ReminderAuthorizationStatus>('not_requested')
  const syncState = shallowRef<ReminderSyncState>('idle')
  const failedOperation = shallowRef<ReminderFailedOperation>(null)
  const pendingResult = shallowRef<ReminderAuthorizationStatus | null>(null)
  const isWorking = shallowRef(false)

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
      status.value = result
      pendingResult.value = result
      await syncPendingResult(result)
    } finally {
      isWorking.value = false
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
    loadStatus
  }
}

export function useReminderConsent() {
  const backend = createBackendClient()

  return createReminderConsent({
    requestAuthorization: config => requestReminderAuthorization({
      templateId: config?.template_id ?? '',
      mode: config?.mode ?? 'test'
    }),
    async syncAuthorization(status) {
      await backend.ensureSession()
      await backend.updateReminderAuthorization(status)
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
