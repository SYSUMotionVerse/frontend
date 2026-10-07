export type ReminderAuthorizationStatus =
  | 'not_requested'
  | 'accepted'
  | 'test_accepted'
  | 'rejected'
  | 'banned'
  | 'unsupported'
  | 'unconfigured'

export type ReminderSyncState = 'idle' | 'syncing' | 'synced' | 'failed'
export type ReminderFailedOperation = 'load_config' | 'sync_result' | null
export type ReminderAuthorizationMode = 'test' | 'production'

export type ReminderTemplateOutcome = 'accept' | 'reject' | 'ban' | 'filter'

export type ReminderAuthorizationConfig = {
  /**
   * Private template ids configured server-side, ordered by slot. A
   * one-time subscription grants one send credit per accepted template.
   * Both reminder slots normally share one template and one credit pool;
   * one accepted request must not be counted twice because there are two slots.
   */
  template_ids: string[]
  mode: ReminderAuthorizationMode
}

export type ReminderGrant = {
  template_id: string
  status: ReminderTemplateOutcome
}

export type ReminderAuthorizationResult = {
  status: ReminderAuthorizationStatus
  grants: ReminderGrant[]
  errorMessage?: string
  settingsRequired?: boolean
}

type SubscribeMessageResult = Record<string, string>

type RequestSubscribeMessage = (options: {
  tmplIds: string[]
  success: (result: SubscribeMessageResult) => void
  fail: (error: { errMsg?: string; errCode?: number }) => void
}) => void

type RequestReminderAuthorizationOptions = {
  templateIds: string[]
  mode: ReminderAuthorizationMode
  requestSubscribeMessage?: RequestSubscribeMessage
}

function resolveDefaultRequester(): RequestSubscribeMessage | undefined {
  if (typeof wx === 'undefined' || typeof wx.requestSubscribeMessage !== 'function') {
    return undefined
  }

  return options => wx.requestSubscribeMessage(options)
}

export function reminderSettingsRequireChange(templateIds: string[]): Promise<boolean> {
  if (typeof wx === 'undefined' || typeof wx.getSetting !== 'function') {
    return Promise.resolve(false)
  }
  return new Promise(resolve => {
    wx.getSetting!({
      withSubscriptions: true,
      success(result) {
        const subscriptions = result.subscriptionsSetting
        resolve(subscriptions?.mainSwitch === false || templateIds.some(
          id => subscriptions?.itemSettings?.[id] === 'reject'
        ))
      },
      fail() { resolve(false) }
    })
  })
}

export function openReminderSettings(): Promise<void> {
  if (typeof wx === 'undefined' || typeof wx.openSetting !== 'function') {
    return Promise.reject(new Error('请在微信小程序右上角设置中管理订阅消息'))
  }
  return new Promise((resolve, reject) => {
    wx.openSetting!({
      withSubscriptions: true,
      success() { resolve() },
      fail() { reject(new Error('无法打开微信设置，请从小程序右上角进入设置')) }
    })
  })
}

function normalizeTemplateOutcome(value: unknown): ReminderTemplateOutcome {
  if (value === 'accept' || value === 'reject' || value === 'ban' || value === 'filter') {
    return value
  }
  return 'reject'
}

/**
 * Request one-time subscription authorisation for the configured templates.
 *
 * Each template that the user accepts contributes one send credit on the
 * server. When the participant previously ticked “always keep my choice” in
 * the WeChat subscription panel this call resolves silently without showing
 * the dialog again, so it can be attached to high-frequency user actions
 * without producing a prompt each time.
 */
export async function requestReminderAuthorization(
  options: RequestReminderAuthorizationOptions
): Promise<ReminderAuthorizationResult> {
  const templateIds = [...new Set(options.templateIds.map(id => id.trim()).filter(Boolean))]
  if (templateIds.length === 0) {
    return { status: 'unconfigured', grants: [] }
  }

  const requestSubscribeMessage = options.requestSubscribeMessage ?? resolveDefaultRequester()
  if (!requestSubscribeMessage) {
    return { status: 'unsupported', grants: [] }
  }

  return new Promise(resolve => {
    requestSubscribeMessage({
      tmplIds: templateIds,
      success(result) {
        const grants = templateIds.map(templateId => ({
          template_id: templateId,
          status: normalizeTemplateOutcome(result[templateId]),
        }))
        const accepted = grants.some(grant => grant.status === 'accept')
        const banned = grants.every(grant => grant.status === 'ban')
        const status: ReminderAuthorizationStatus = accepted
          ? (options.mode === 'production' ? 'accepted' : 'test_accepted')
          : banned
            ? 'banned'
            : 'rejected'
        resolve({ status, grants })
      },
      fail(error) {
        resolve({
          status: 'not_requested',
          grants: [],
          errorMessage: error.errCode === 20004
            ? '微信订阅消息已关闭，请在微信设置中开启后再授权'
            : error.errMsg || '微信未能打开订阅授权，请稍后重试',
          settingsRequired: error.errCode === 20004
        })
      }
    })
  })
}
