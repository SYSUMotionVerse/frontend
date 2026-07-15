import type { ReminderAuthorizationStatus } from '../../uni-app/platform/reminderConsent'

type ReminderAuthorizationPresentation = {
  homeTitle: string
  homeDetail: string
  consentMessage: string
  canRetryAuthorization: boolean
}

export const REMINDER_AUTHORIZATION_PRESENTATION = {
  not_requested: {
    homeTitle: '微信提醒尚未确认',
    homeDetail: '你仍可正常训练，需要时可主动授权。',
    consentMessage: '',
    canRetryAuthorization: true
  },
  accepted: {
    homeTitle: '微信提醒已开启',
    homeDetail: '符合条件时，我们会在 12:00 和 18:00 发送训练进度提醒。',
    consentMessage: '微信授权已记录。',
    canRetryAuthorization: false
  },
  test_accepted: {
    homeTitle: '测试授权已记录',
    homeDetail: '当前是测试或非生产配置，不代表长期订阅消息已经获批或可正式送达。',
    consentMessage: '已记录测试授权，但长期订阅模板尚未完成生产验收。',
    canRetryAuthorization: false
  },
  rejected: {
    homeTitle: '未开启微信提醒',
    homeDetail: '你仍可正常训练，需要时可主动再次授权。',
    consentMessage: '',
    canRetryAuthorization: true
  },
  banned: {
    homeTitle: '未开启微信提醒',
    homeDetail: '微信已禁止该类消息，可调整微信设置后重试。',
    consentMessage: '微信中已禁止该类消息，可稍后在训练首页查看状态。',
    canRetryAuthorization: true
  },
  unsupported: {
    homeTitle: '未开启微信提醒',
    homeDetail: '当前平台不支持微信授权，可在微信小程序中重试。',
    consentMessage: '当前环境不支持微信订阅授权，你仍可正常训练。',
    canRetryAuthorization: true
  },
  unconfigured: {
    homeTitle: '未开启微信提醒',
    homeDetail: '长期订阅模板尚未配置，当前不会发送微信消息。',
    consentMessage: '长期订阅模板尚未配置，当前仅记录配置状态。',
    canRetryAuthorization: true
  }
} satisfies Record<ReminderAuthorizationStatus, ReminderAuthorizationPresentation>
