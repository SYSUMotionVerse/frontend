import { computed, readonly, shallowRef } from 'vue'
import { createBackendClient } from '../api/backendClient'
import {
  requestReminderAuthorization,
  type ReminderAuthorizationConfig,
  type ReminderAuthorizationStatus,
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
  const isWorking = shallowRef(false)

  const canRetrySync = computed(() => syncState.value === 'failed')

  async function syncCurrentStatus() {
    syncState.value = 'syncing'
    try {
      await dependencies.syncAuthorization(status.value)
      syncState.value = 'synced'
    } catch {
      syncState.value = 'failed'
    }
  }

  async function authorize() {
    isWorking.value = true
    try {
      const config = dependencies.loadAuthorizationConfig
        ? await dependencies.loadAuthorizationConfig()
        : undefined
      status.value = await dependencies.requestAuthorization(config)
      await syncCurrentStatus()
    } catch {
      status.value = 'unconfigured'
      syncState.value = 'failed'
    } finally {
      isWorking.value = false
    }
  }

  async function decline() {
    status.value = 'rejected'
    await syncCurrentStatus()
  }

  async function retrySync() {
    if (!canRetrySync.value) {
      return
    }
    await syncCurrentStatus()
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
    isWorking: readonly(isWorking),
    canRetrySync,
    authorize,
    decline,
    retrySync,
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
