import { computed, readonly, shallowRef } from 'vue'
import { createBackendClient } from '../api/backendClient'
import {
  requestReminderAuthorization,
  reminderSettingsRequireChange,
  openReminderSettings,
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
  settingsRequireChange?: (templateIds: string[]) => Promise<boolean>
  openSettings?: () => Promise<void>
}

export function createReminderConsent(dependencies: ReminderConsentDependencies) {
  const status = shallowRef<ReminderAuthorizationStatus>('not_requested')
  const syncState = shallowRef<ReminderSyncState>('idle')
  const failedOperation = shallowRef<ReminderFailedOperation>(null)
  const pendingResult = shallowRef<ReminderAuthorizationStatus | null>(null)
  const isWorking = shallowRef(false)
  const topUpInFlight = shallowRef(false)
  const lastError = shallowRef('')
  const needsSettings = shallowRef(false)
  let authorizationConfig: ReminderAuthorizationConfig | undefined

  async function prepare() {
    if (!dependencies.loadAuthorizationConfig) return
    authorizationConfig = await dependencies.loadAuthorizationConfig()
    await refreshSettings()
  }

  async function refreshSettings() {
    if (dependencies.settingsRequireChange) {
      needsSettings.value = await dependencies.settingsRequireChange(authorizationConfig?.template_ids ?? [])
    }
  }

  async function openSettings() {
    if (!dependencies.openSettings) return
    lastError.value = ''
    try {
      // Call before awaiting anything so WeChat receives the button gesture.
      await dependencies.openSettings()
      await refreshSettings()
      lastError.value = needsSettings.value
        ? '请开启订阅消息，并将训练提醒改为允许'
        : '设置已更新，请再次点击授权'
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : '无法打开微信设置，请稍后重试'
    }
  }

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
    if (isWorking.value || topUpInFlight.value) return
    isWorking.value = true
    failedOperation.value = null
    lastError.value = ''
    try {
      if (dependencies.loadAuthorizationConfig && !authorizationConfig) {
        try {
          await prepare()
          syncState.value = 'idle'
          pendingResult.value = null
          lastError.value = '提醒配置已加载，请再次点击授权'
        } catch {
          syncState.value = 'failed'
          failedOperation.value = 'load_config'
          pendingResult.value = null
          lastError.value = '提醒配置加载失败，请稍后重试'
        }
        // A network round trip loses the original WeChat tap context. Let the
        // next tap call the platform directly with the prepared configuration.
        return
      }

      const result = await dependencies.requestAuthorization(authorizationConfig)
      if (result.errorMessage) {
        lastError.value = result.errorMessage
        needsSettings.value = result.settingsRequired ?? false
        return
      }
      status.value = result.status
      pendingResult.value = result.status
      await syncGrants(result.grants)
      await syncPendingResult(result.status)
      await refreshSettings()
    } catch {
      lastError.value = '微信授权暂时失败，请再次点击重试'
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
    if (topUpInFlight.value || isWorking.value || needsSettings.value) return
    if (status.value === 'banned' || status.value === 'unconfigured' || status.value === 'unsupported') {
      return
    }
    topUpInFlight.value = true
    try {
      if (dependencies.loadAuthorizationConfig && !authorizationConfig) {
        await prepare()
        return
      }
      const result = await dependencies.requestAuthorization(authorizationConfig)
      if (result.errorMessage) {
        needsSettings.value = result.settingsRequired ?? false
        return
      }
      if (result.status !== 'not_requested') {
        status.value = result.status
      }
      await syncGrants(result.grants)
      await refreshSettings()
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
      if ('template_ids' in persisted && 'mode' in persisted) {
        const config = persisted as typeof persisted & ReminderAuthorizationConfig
        authorizationConfig = { template_ids: config.template_ids, mode: config.mode }
      }
      status.value = persisted.status
      syncState.value = 'synced'
      await refreshSettings()
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
    lastError: readonly(lastError),
    needsSettings: readonly(needsSettings),
    openSettings,
    prepare,
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
    settingsRequireChange: reminderSettingsRequireChange,
    openSettings: openReminderSettings,
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
