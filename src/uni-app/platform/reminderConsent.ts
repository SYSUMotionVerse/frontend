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
   * one-time subscription grants one send credit per accepted template, so
   * requesting both configured slots' templates at once yields two credits.
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
}

type SubscribeMessageResult = Record<string, string>

type RequestSubscribeMessage = (options: {
  tmplIds: string[]
  success: (result: SubscribeMessageResult) => void
  fail: () => void
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
  const templateIds = options.templateIds.filter(id => id.trim().length > 0)
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
      fail() {
        resolve({ status: 'unsupported', grants: [] })
      }
    })
  })
}
