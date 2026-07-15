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
export type ReminderAuthorizationConfig = {
  template_id: string
  mode: ReminderAuthorizationMode
}

type SubscribeMessageResult = Record<string, 'accept' | 'reject' | 'ban' | string>

type RequestSubscribeMessage = (options: {
  tmplIds: string[]
  success: (result: SubscribeMessageResult) => void
  fail: () => void
}) => void

type RequestReminderAuthorizationOptions = {
  templateId: string
  mode: ReminderAuthorizationMode
  requestSubscribeMessage?: RequestSubscribeMessage
}

function resolveDefaultRequester(): RequestSubscribeMessage | undefined {
  if (typeof wx === 'undefined' || typeof wx.requestSubscribeMessage !== 'function') {
    return undefined
  }

  return options => wx.requestSubscribeMessage(options)
}

export async function requestReminderAuthorization(
  options: RequestReminderAuthorizationOptions
): Promise<ReminderAuthorizationStatus> {
  if (!options.templateId) {
    return 'unconfigured'
  }

  const requestSubscribeMessage = options.requestSubscribeMessage ?? resolveDefaultRequester()
  if (!requestSubscribeMessage) {
    return 'unsupported'
  }

  return new Promise(resolve => {
    requestSubscribeMessage({
      tmplIds: [options.templateId],
      success(result) {
        const outcome = result[options.templateId]
        if (outcome === 'accept') {
          resolve(options.mode === 'production' ? 'accepted' : 'test_accepted')
          return
        }

        resolve(outcome === 'ban' ? 'banned' : 'rejected')
      },
      fail() {
        resolve('unsupported')
      }
    })
  })
}
