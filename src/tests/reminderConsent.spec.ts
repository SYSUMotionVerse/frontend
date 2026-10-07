import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

describe('WeChat reminder authorization adapter', () => {
  it.each([
    ['accept', 'accepted'],
    ['reject', 'rejected'],
    ['ban', 'banned']
  ] as const)('maps %s to %s', async (wechatValue, expected) => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')

    const outcome = await requestReminderAuthorization({
      templateIds: ['template-1'],
      mode: 'production',
      requestSubscribeMessage: vi.fn(({ success }) => {
        success({ 'template-1': wechatValue })
      })
    })

    expect(outcome.status).toBe(expected)
    expect(outcome.grants).toEqual([
      { template_id: 'template-1', status: wechatValue === 'ban' ? 'ban' : wechatValue }
    ])
  })

  it('requests every configured template and returns per-template grants', async () => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')
    const requestSubscribeMessage = vi.fn(({ success }) => {
      success({
        'noon-tpl': 'accept',
        'evening-tpl': 'reject',
      })
    })

    const outcome = await requestReminderAuthorization({
      templateIds: ['noon-tpl', 'evening-tpl'],
      mode: 'production',
      requestSubscribeMessage,
    })

    expect(requestSubscribeMessage).toHaveBeenCalledWith(expect.objectContaining({
      tmplIds: ['noon-tpl', 'evening-tpl'],
    }))
    expect(outcome.status).toBe('accepted')
    expect(outcome.grants).toEqual([
      { template_id: 'noon-tpl', status: 'accept' },
      { template_id: 'evening-tpl', status: 'reject' },
    ])
  })

  it('returns unconfigured without calling WeChat when no template is configured', async () => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')
    const requestSubscribeMessage = vi.fn()

    const outcome = await requestReminderAuthorization({
      templateIds: [],
      mode: 'production',
      requestSubscribeMessage
    })

    expect(outcome.status).toBe('unconfigured')
    expect(outcome.grants).toEqual([])
    expect(requestSubscribeMessage).not.toHaveBeenCalled()
  })

  it('returns unsupported outside a platform that implements subscription messages', async () => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')

    await expect(requestReminderAuthorization({ templateIds: ['template-1'], mode: 'production' }))
      .resolves.toEqual({ status: 'unsupported', grants: [] })
  })

  it('persists a truthful non-production outcome when a test build receives acceptance', async () => {
    const { requestReminderAuthorization } = await import('../uni-app/platform/reminderConsent')

    const outcome = await requestReminderAuthorization({
      templateIds: ['template-1'],
      mode: 'test',
      requestSubscribeMessage: vi.fn(({ success }) => {
        success({ 'template-1': 'accept' })
      })
    })

    expect(outcome.status).toBe('test_accepted')
  })

})

describe('reminder consent composable', () => {
  it('keeps the authorization result when backend synchronization fails and supports retry', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const syncAuthorization = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ status: 'accepted', updated_at: '2026-07-16T12:00:00Z' })

    const consent = createReminderConsent({
      requestAuthorization: vi.fn().mockResolvedValue({ status: 'accepted', grants: [] }),
      syncAuthorization,
      reportGrants: vi.fn()
    })

    await consent.authorize()

    expect(consent.status.value).toBe('accepted')
    expect(consent.syncState.value).toBe('failed')
    expect(consent.canRetrySync.value).toBe(true)

    expect(consent.failedOperation.value).toBe('sync_result')
    expect(consent.pendingResult.value).toBe('accepted')

    await consent.retryFailedOperation()

    expect(syncAuthorization).toHaveBeenCalledTimes(2)
    expect(consent.syncState.value).toBe('synced')
    expect(consent.pendingResult.value).toBeNull()
  })

  it('loads persisted state without opening the WeChat authorization prompt', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const requestAuthorization = vi.fn()
    const consent = createReminderConsent({
      requestAuthorization,
      reportGrants: vi.fn(),
      syncAuthorization: vi.fn(),
      loadAuthorization: vi.fn().mockResolvedValue({ status: 'rejected' })
    })

    await consent.loadStatus()

    expect(consent.status.value).toBe('rejected')
    expect(requestAuthorization).not.toHaveBeenCalled()
  })

  it('loads fresh backend template configuration at authorization time', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const requestAuthorization = vi.fn().mockResolvedValue({ status: 'test_accepted', grants: [] })
    const loadAuthorizationConfig = vi.fn().mockResolvedValue({
      template_ids: ['server-template-id'],
      mode: 'test'
    })
    const consent = createReminderConsent({
      requestAuthorization,
      reportGrants: vi.fn(),
      syncAuthorization: vi.fn(),
      loadAuthorizationConfig
    })

    await consent.authorize()

    expect(loadAuthorizationConfig).toHaveBeenCalledTimes(1)
    expect(requestAuthorization).toHaveBeenCalledWith({
      template_ids: ['server-template-id'],
      mode: 'test'
    })
    expect(consent.status.value).toBe('test_accepted')
  })

  it('preserves an accepted status and does not PATCH when config GET fails', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const syncAuthorization = vi.fn()
    const requestAuthorization = vi.fn()
    const consent = createReminderConsent({
      requestAuthorization,
      reportGrants: vi.fn(),
      syncAuthorization,
      loadAuthorization: vi.fn().mockResolvedValue({ status: 'accepted' }),
      loadAuthorizationConfig: vi.fn().mockRejectedValue(new Error('offline'))
    })
    await consent.loadStatus()

    await consent.authorize()

    expect(consent.status.value).toBe('accepted')
    expect(consent.failedOperation.value).toBe('load_config')
    expect(consent.pendingResult.value).toBeNull()
    expect(requestAuthorization).not.toHaveBeenCalled()
    expect(syncAuthorization).not.toHaveBeenCalled()
  })

  it('re-fetches configuration and opens the platform flow when config retry succeeds', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const loadAuthorizationConfig = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ template_ids: ['server-template-id'], mode: 'test' })
    const requestAuthorization = vi.fn().mockResolvedValue({ status: 'test_accepted', grants: [] })
    const syncAuthorization = vi.fn().mockResolvedValue(undefined)
    const consent = createReminderConsent({
      requestAuthorization,
      reportGrants: vi.fn(),
      syncAuthorization,
      loadAuthorizationConfig
    })

    await consent.authorize()
    await consent.retryFailedOperation()

    expect(loadAuthorizationConfig).toHaveBeenCalledTimes(2)
    expect(requestAuthorization).toHaveBeenCalledTimes(1)
    expect(syncAuthorization).toHaveBeenCalledWith('test_accepted')
    expect(consent.status.value).toBe('test_accepted')
  })

  it('retries PATCH with the exact pending platform result without reopening WeChat', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const requestAuthorization = vi.fn().mockResolvedValue({ status: 'accepted', grants: [] })
    const loadAuthorizationConfig = vi.fn().mockResolvedValue({
      template_ids: ['server-template-id'],
      mode: 'production'
    })
    const syncAuthorization = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    const consent = createReminderConsent({
      requestAuthorization,
      reportGrants: vi.fn(),
      syncAuthorization,
      loadAuthorizationConfig
    })

    await consent.authorize()
    await consent.retryFailedOperation()

    expect(loadAuthorizationConfig).toHaveBeenCalledTimes(1)
    expect(requestAuthorization).toHaveBeenCalledTimes(1)
    expect(syncAuthorization).toHaveBeenNthCalledWith(1, 'accepted')
    expect(syncAuthorization).toHaveBeenNthCalledWith(2, 'accepted')
  })

  it('reports per-template grants so the server can account send credits', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const grants = [
      { template_id: 'noon-tpl', status: 'accept' as const },
      { template_id: 'evening-tpl', status: 'reject' as const },
    ]
    const reportGrants = vi.fn().mockResolvedValue(undefined)
    const consent = createReminderConsent({
      requestAuthorization: vi.fn().mockResolvedValue({ status: 'accepted', grants }),
      syncAuthorization: vi.fn(),
      reportGrants,
      loadAuthorizationConfig: vi.fn().mockResolvedValue({
        template_ids: ['noon-tpl', 'evening-tpl'],
        mode: 'production',
      }),
    })

    await consent.authorize()

    expect(reportGrants).toHaveBeenCalledWith(grants)
  })

  it('silently tops up quota on a high-frequency action without blocking it', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const grants = [{ template_id: 'noon-tpl', status: 'accept' as const }]
    const requestAuthorization = vi.fn().mockResolvedValue({ status: 'accepted', grants })
    const reportGrants = vi.fn().mockResolvedValue(undefined)
    const consent = createReminderConsent({
      requestAuthorization,
      syncAuthorization: vi.fn(),
      reportGrants,
      loadAuthorizationConfig: vi.fn().mockResolvedValue({
        template_ids: ['noon-tpl'],
        mode: 'production',
      }),
    })

    await consent.topUpQuota()

    expect(requestAuthorization).toHaveBeenCalledTimes(1)
    expect(reportGrants).toHaveBeenCalledWith(grants)
    // topUpQuota does not push the result through the PATCH status channel.
    expect(consent.syncState.value).not.toBe('failed')
  })

  it('reports a new grant on each completed top-up without waiting for consumption', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const grants = [
      { template_id: 'noon-tpl', status: 'accept' as const },
      { template_id: 'evening-tpl', status: 'accept' as const }
    ]
    const requestAuthorization = vi.fn().mockResolvedValue({ status: 'accepted', grants })
    const reportGrants = vi.fn().mockResolvedValue(undefined)
    const consent = createReminderConsent({
      requestAuthorization,
      syncAuthorization: vi.fn(),
      reportGrants
    })

    await consent.topUpQuota()
    await consent.topUpQuota()
    await consent.topUpQuota()

    expect(requestAuthorization).toHaveBeenCalledTimes(3)
    expect(reportGrants).toHaveBeenCalledTimes(3)
    expect(reportGrants).toHaveBeenLastCalledWith(grants)
  })

  it('coalesces overlapping top-ups and allows the next click after completion', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    let finishRequest!: (result: { status: 'accepted'; grants: [] }) => void
    const requestAuthorization = vi.fn().mockImplementation(() => new Promise(resolve => {
      finishRequest = resolve
    }))
    const consent = createReminderConsent({
      requestAuthorization,
      syncAuthorization: vi.fn(),
      reportGrants: vi.fn()
    })

    const first = consent.topUpQuota()
    await consent.topUpQuota()
    expect(requestAuthorization).toHaveBeenCalledTimes(1)
    finishRequest({ status: 'accepted', grants: [] })
    await first

    const next = consent.topUpQuota()
    expect(requestAuthorization).toHaveBeenCalledTimes(2)
    finishRequest({ status: 'accepted', grants: [] })
    await next
  })

  it('contains platform exceptions and lets a subsequent button try again', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const requestAuthorization = vi.fn()
      .mockRejectedValueOnce(new Error('platform failure'))
      .mockResolvedValueOnce({ status: 'accepted', grants: [] })
    const consent = createReminderConsent({
      requestAuthorization,
      syncAuthorization: vi.fn(),
      reportGrants: vi.fn()
    })

    await expect(consent.topUpQuota()).resolves.toBeUndefined()
    await consent.topUpQuota()

    expect(requestAuthorization).toHaveBeenCalledTimes(2)
    expect(consent.status.value).toBe('accepted')
  })

  it('does not attempt a silent top-up when WeChat reported a persistent rejection', async () => {
    const { createReminderConsent } = await import('../uni-app/composables/useReminderConsent')
    const requestAuthorization = vi.fn()
    const consent = createReminderConsent({
      requestAuthorization,
      syncAuthorization: vi.fn(),
      reportGrants: vi.fn(),
      loadAuthorization: vi.fn().mockResolvedValue({ status: 'banned' }),
      loadAuthorizationConfig: vi.fn().mockResolvedValue({
        template_ids: ['tpl'],
        mode: 'production',
      }),
    })
    await consent.loadStatus()

    await consent.topUpQuota()

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

  it('labels test acceptance without claiming production reminder delivery', async () => {
    const ReminderAuthorizationStatus = (
      await import('../components/training/ReminderAuthorizationStatus.vue')
    ).default
    const wrapper = mount(ReminderAuthorizationStatus, {
      props: {
        status: 'test_accepted',
        syncState: 'synced',
        isWorking: false
      }
    })

    expect(wrapper.text()).toContain('测试授权已记录')
    expect(wrapper.text()).toContain('不代表订阅消息已经获批或可正式送达')
    expect(wrapper.find('.reminder-authorization-status__action').exists()).toBe(false)
  })

  it('does not offer authorization retry when server configuration is unavailable', async () => {
    const ReminderAuthorizationStatus = (
      await import('../components/training/ReminderAuthorizationStatus.vue')
    ).default
    const wrapper = mount(ReminderAuthorizationStatus, {
      props: {
        status: 'unconfigured',
        syncState: 'synced',
        isWorking: false
      }
    })

    expect(wrapper.text()).toContain('请联系研究管理员完成模板配置')
    expect(wrapper.find('.reminder-authorization-status__action').exists()).toBe(false)
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
        failedOperation: { value: null },
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

  it('keeps a failed platform result on screen for retry while allowing training', async () => {
    vi.resetModules()
    const reLaunch = vi.fn()
    vi.stubGlobal('uni', { reLaunch })
    const status = shallowRef('accepted')
    const syncState = shallowRef<'idle' | 'syncing' | 'synced' | 'failed'>('idle')
    const authorize = vi.fn(async () => {
      syncState.value = 'failed'
    })
    const failedOperation = shallowRef<'load_config' | 'sync_result' | null>('sync_result')
    const retryFailedOperation = vi.fn(async () => {
      syncState.value = 'synced'
      failedOperation.value = null
    })

    vi.doMock('../uni-app/composables/useReminderConsent', () => ({
      useReminderConsent: () => ({
        status,
        syncState,
        isWorking: shallowRef(false),
        failedOperation,
        authorize,
        decline: vi.fn(),
        retryFailedOperation
      })
    }))

    const ConsentPage = (await import('../uni-app/pages/access/reminder-consent.vue')).default
    const wrapper = mount(ConsentPage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          ReminderConsentCard: {
            props: ['syncState'],
            template: `
              <div>
                <button class="authorize" @click="$emit('authorize')">authorize</button>
                <button v-if="syncState === 'failed'" class="retry-sync" @click="$emit('retry-failure')">retry</button>
                <button v-if="syncState === 'failed'" class="continue" @click="$emit('continue')">continue</button>
              </div>
            `
          }
        }
      }
    })

    await wrapper.get('.authorize').trigger('click')
    await flushPromises()

    expect(reLaunch).not.toHaveBeenCalled()
    expect(wrapper.find('.retry-sync').exists()).toBe(true)
    expect(wrapper.find('.continue').exists()).toBe(true)

    await wrapper.get('.continue').trigger('click')
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/training/home' })

    reLaunch.mockClear()
    await wrapper.get('.retry-sync').trigger('click')
    await flushPromises()
    expect(retryFailedOperation).toHaveBeenCalledTimes(1)
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/training/home' })
  })

  it('preserves the page state and re-runs authorization after config loading recovers', async () => {
    vi.resetModules()
    const reLaunch = vi.fn()
    vi.stubGlobal('uni', { reLaunch })
    const status = shallowRef('accepted')
    const syncState = shallowRef<'idle' | 'syncing' | 'synced' | 'failed'>('idle')
    const failedOperation = shallowRef<'load_config' | 'sync_result' | null>(null)
    const authorize = vi.fn(async () => {
      syncState.value = 'failed'
      failedOperation.value = 'load_config'
    })
    const retryFailedOperation = vi.fn(async () => {
      status.value = 'test_accepted'
      syncState.value = 'synced'
      failedOperation.value = null
    })

    vi.doMock('../uni-app/composables/useReminderConsent', () => ({
      useReminderConsent: () => ({
        status,
        syncState,
        failedOperation,
        isWorking: shallowRef(false),
        authorize,
        decline: vi.fn(),
        retryFailedOperation
      })
    }))

    const ConsentPage = (await import('../uni-app/pages/access/reminder-consent.vue')).default
    const wrapper = mount(ConsentPage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' }
        }
      }
    })

    await wrapper.get('.reminder-consent__primary').trigger('click')
    await flushPromises()

    expect(status.value).toBe('accepted')
    expect(reLaunch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('当前状态保持不变')
    expect(wrapper.text()).toContain('重新获取配置并授权')

    await wrapper.get('.reminder-consent__retry-sync').trigger('click')
    await flushPromises()

    expect(retryFailedOperation).toHaveBeenCalledTimes(1)
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/training/home' })
  })
})
