import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

describe('WeChat reminder authorization adapter', () => {
  it.each([
    ['accept', 'accepted'],
    ['reject', 'rejected'],
    ['ban', 'banned']
  ] as const)('maps %s to %s', async (wechatValue, expected) => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')

    const outcome = await requestReminderAuthorization({
      templateIds: ['template-1'],
      requestSubscribeMessage: vi.fn(({ success }) => {
        success({ 'template-1': wechatValue })
      })
    })

    expect(outcome).toBe(expected)
  })

  it('returns unconfigured without calling WeChat when no template is configured', async () => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')
    const requestSubscribeMessage = vi.fn()

    const outcome = await requestReminderAuthorization({
      templateIds: [],
      requestSubscribeMessage
    })

    expect(outcome).toBe('unconfigured')
    expect(requestSubscribeMessage).not.toHaveBeenCalled()
  })

  it('returns unsupported outside a platform that implements subscription messages', async () => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')

    await expect(requestReminderAuthorization({ templateIds: ['template-1'] }))
      .resolves.toBe('unsupported')
  })
})

describe('reminder consent composable', () => {
  it('keeps the authorization result when backend synchronization fails and supports retry', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const syncAuthorization = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ status: 'accepted', updated_at: '2026-07-16T12:00:00Z' })

    const consent = createReminderConsent({
      requestAuthorization: vi.fn().mockResolvedValue('accepted'),
      syncAuthorization
    })

    await consent.authorize()

    expect(consent.status.value).toBe('accepted')
    expect(consent.syncState.value).toBe('failed')
    expect(consent.canRetrySync.value).toBe(true)

    await consent.retrySync()

    expect(syncAuthorization).toHaveBeenCalledTimes(2)
    expect(consent.syncState.value).toBe('synced')
  })

  it('loads persisted state without opening the WeChat authorization prompt', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const requestAuthorization = vi.fn()
    const consent = createReminderConsent({
      requestAuthorization,
      syncAuthorization: vi.fn(),
      loadAuthorization: vi.fn().mockResolvedValue({ status: 'rejected' })
    })

    await consent.loadStatus()

    expect(consent.status.value).toBe('rejected')
    expect(requestAuthorization).not.toHaveBeenCalled()
  })
})

describe('training-home reminder status', () => {
  it('offers an explicit authorization retry for a declined participant', async () => {
    const ReminderAuthorizationStatus = (
      await import('../components/training/ReminderAuthorizationStatus.vue')
    ).default
    const wrapper = mount(ReminderAuthorizationStatus, {
      props: {
        status: 'rejected',
        syncState: 'synced',
        isWorking: false
      }
    })

    expect(wrapper.text()).toContain('未开启微信提醒')
    await wrapper.get('.reminder-authorization-status__action').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

describe('reminder consent page', () => {
  it('requests permission only after explicit action and never blocks entering training', async () => {
    const reLaunch = vi.fn()
    vi.stubGlobal('uni', { reLaunch })
    const authorize = vi.fn().mockResolvedValue(undefined)
    const decline = vi.fn().mockResolvedValue(undefined)

    vi.doMock('../uni-app/composables/useReminderConsent', () => ({
      useReminderConsent: () => ({
        status: { value: 'not_requested' },
        syncState: { value: 'idle' },
        isWorking: { value: false },
        authorize,
        decline
      })
    }))

    const ConsentPage = (await import('../uni-app/pages/access/reminder-consent.vue')).default
    const wrapper = mount(ConsentPage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          ReminderConsentCard: {
            template: `
              <div>
                <button class="authorize" @click="$emit('authorize')">authorize</button>
                <button class="skip" @click="$emit('skip')">skip</button>
              </div>
            `
          }
        }
      }
    })

    expect(authorize).not.toHaveBeenCalled()

    await wrapper.get('.authorize').trigger('click')
    await flushPromises()
    expect(authorize).toHaveBeenCalledTimes(1)
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/training/home' })

    reLaunch.mockClear()
    await wrapper.get('.skip').trigger('click')
    await flushPromises()
    expect(decline).toHaveBeenCalledTimes(1)
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/training/home' })
  })
})
