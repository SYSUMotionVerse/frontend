import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  openReminderSettings,
  reminderSettingsRequireChange,
  requestReminderAuthorization
} from '../uni-app/platform/reminderConsent'
import { createReminderConsent } from '../uni-app/composables/useReminderConsent'
import TrainingReminderAuthorizationCard from '../components/training/TrainingReminderAuthorizationCard.vue'

const config = { template_ids: ['noon', 'evening'], mode: 'production' as const }

afterEach(() => { vi.unstubAllGlobals() })

describe('remembered subscription rejection recovery', () => {
  it.each([
    [{ mainSwitch: false }, true],
    [{ mainSwitch: true, itemSettings: { noon: 'reject' } }, true],
    [{ mainSwitch: true, itemSettings: { noon: 'accept' } }, false],
    [{ mainSwitch: true, itemSettings: { unrelated: 'reject' } }, false]
  ])('checks WeChat saved settings %j', async (subscriptionsSetting, expected) => {
    const getSetting = vi.fn(({ success }) => { success({ subscriptionsSetting }) })
    vi.stubGlobal('wx', { getSetting })

    await expect(reminderSettingsRequireChange(config.template_ids)).resolves.toBe(expected)
    expect(getSetting).toHaveBeenCalledWith(expect.objectContaining({ withSubscriptions: true }))
  })

  it('preserves the WeChat main-switch error instead of claiming an unsupported platform', async () => {
    const result = await requestReminderAuthorization({
      templateIds: config.template_ids,
      mode: config.mode,
      requestSubscribeMessage: ({ fail }) => {
        fail({ errCode: 20004, errMsg: 'requestSubscribeMessage:fail The main switch is switched off' })
      }
    })

    expect(result.status).toBe('not_requested')
    expect(result.settingsRequired).toBe(true)
    expect(result.errorMessage).toContain('微信设置')
    expect(result.grants).toEqual([])
  })

  it('opens settings synchronously on the tap and does not count setting changes as grants', async () => {
    const openSetting = vi.fn(({ success }) => { success() })
    vi.stubGlobal('wx', { openSetting })
    const request = openReminderSettings()
    expect(openSetting).toHaveBeenCalledTimes(1)
    await request
  })

  it('preloads config and saved rejection, then requires a separate authorization after settings', async () => {
    const settingsRequireChange = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false)
    const requestAuthorization = vi.fn().mockResolvedValue({
      status: 'accepted', grants: [{ template_id: 'noon', status: 'accept' }]
    })
    const reportGrants = vi.fn()
    const openSettings = vi.fn().mockResolvedValue(undefined)
    const loadAuthorization = vi.fn().mockResolvedValue({ ...config, status: 'rejected' })
    const loadAuthorizationConfig = vi.fn().mockResolvedValue(config)
    const consent = createReminderConsent({
      requestAuthorization, reportGrants, openSettings, settingsRequireChange,
      syncAuthorization: vi.fn(), loadAuthorization, loadAuthorizationConfig
    })

    await consent.loadStatus()
    expect(consent.needsSettings.value).toBe(true)
    await consent.topUpQuota()
    expect(requestAuthorization).not.toHaveBeenCalled()

    await consent.openSettings()
    expect(consent.needsSettings.value).toBe(false)
    expect(reportGrants).not.toHaveBeenCalled()
    expect(consent.lastError.value).toContain('再次点击授权')

    const authorization = consent.authorize()
    expect(requestAuthorization).toHaveBeenCalledWith(config)
    expect(loadAuthorizationConfig).not.toHaveBeenCalled()
    await authorization
    expect(reportGrants).toHaveBeenCalledTimes(1)
  })

  it('does not persist API failures as unsupported or emit subscription grants', async () => {
    const syncAuthorization = vi.fn()
    const reportGrants = vi.fn()
    const consent = createReminderConsent({
      requestAuthorization: vi.fn().mockResolvedValue({
        status: 'not_requested', grants: [], errorMessage: '订阅消息总开关已关闭', settingsRequired: true
      }),
      syncAuthorization, reportGrants
    })

    await consent.authorize()
    expect(consent.needsSettings.value).toBe(true)
    expect(consent.lastError.value).toContain('已关闭')
    expect(syncAuthorization).not.toHaveBeenCalled()
    expect(reportGrants).not.toHaveBeenCalled()
  })

  it('requests another tap rather than invoking WeChat after a network request', async () => {
    const requestAuthorization = vi.fn().mockResolvedValue({ status: 'accepted', grants: [] })
    const consent = createReminderConsent({
      requestAuthorization, syncAuthorization: vi.fn(), reportGrants: vi.fn(),
      loadAuthorizationConfig: vi.fn().mockResolvedValue(config)
    })
    await consent.authorize()
    expect(requestAuthorization).not.toHaveBeenCalled()
    expect(consent.lastError.value).toContain('再次点击')
    const next = consent.authorize()
    expect(requestAuthorization).toHaveBeenCalledTimes(1)
    await next
  })

  it('shows an actionable settings button after a saved rejection', () => {
    const wrapper = mount(TrainingReminderAuthorizationCard, {
      props: { working: false, needsSettings: true },
      global: { stubs: { UniIcons: true } }
    })
    expect(wrapper.get('button').text()).toBe('去微信设置')
    expect(wrapper.text()).toContain('微信已记住拒绝')
  })
})
