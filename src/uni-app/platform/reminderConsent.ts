export type ReminderAuthorizationStatus =
  | 'not_requested'
  | 'accepted'
  | 'rejected'
  | 'banned'
  | 'unsupported'
  | 'unconfigured'

type SubscribeMessageResult = Record<string, 'accept' | 'reject' | 'ban' | string>

type RequestSubscribeMessage = (options: {
  tmplIds: string[]
  success: (result: SubscribeMessageResult) => void
  fail: () => void
}) => void

type RequestReminderAuthorizationOptions = {
  templateIds: string[]
  requestSubscribeMessage?: RequestSubscribeMessage
}

export function resolveReminderTemplateIds(
  configured: string = import.meta.env.VITE_WECHAT_REMINDER_TEMPLATE_IDS ?? ''
) {
  return configured
    .split(',')
    .map(templateId => templateId.trim())
    .filter(Boolean)
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
  if (options.templateIds.length === 0) {
    return 'unconfigured'
  }

  const requestSubscribeMessage = options.requestSubscribeMessage ?? resolveDefaultRequester()
  if (!requestSubscribeMessage) {
    return 'unsupported'
  }

  return new Promise(resolve => {
    requestSubscribeMessage({
      tmplIds: options.templateIds,
      success(result) {
        const outcomes = options.templateIds.map(templateId => result[templateId])
        if (outcomes.includes('accept')) {
          resolve('accepted')
          return
        }

        resolve(outcomes.includes('ban') ? 'banned' : 'rejected')
      },
      fail() {
        resolve('unsupported')
      }
    })
  })
}
