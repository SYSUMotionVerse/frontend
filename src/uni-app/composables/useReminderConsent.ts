import { computed, readonly, shallowRef } from 'vue'
import { createBackendClient } from '../api/backendClient'
import {
  requestReminderAuthorization,
  resolveReminderAuthorizationMode,
  resolveReminderTemplateId,
  type ReminderAuthorizationStatus,
  type ReminderSyncState
} from '../platform/reminderConsent'

type ReminderConsentDependencies = {
  requestAuthorization: () => Promise<ReminderAuthorizationStatus>
  syncAuthorization: (status: ReminderAuthorizationStatus) => Promise<unknown>
  loadAuthorization?: () => Promise<{ status: ReminderAuthorizationStatus }>
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
      status.value = await dependencies.requestAuthorization()
      await syncCurrentStatus()
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
    requestAuthorization: () => requestReminderAuthorization({
      templateId: resolveReminderTemplateId(),
      mode: resolveReminderAuthorizationMode()
    }),
    async syncAuthorization(status) {
      await backend.ensureSession()
      await backend.updateReminderAuthorization(status)
    },
    async loadAuthorization() {
      await backend.ensureSession()
      return backend.getReminderAuthorization()
    }
  })
}
