import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadStationNotifications = vi.fn()
const markStationNotificationRead = vi.fn()
const navigateTo = vi.fn()
const reportBackendSyncError = vi.fn()

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onShow: vi.fn((callback: () => unknown) => callback())
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    loadStationNotifications,
    markStationNotificationRead
  }
}))

vi.mock('../uni-app/api/reportBackendSyncError', () => ({
  reportBackendSyncError
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    setReminderSource: vi.fn(),
    state: {
      profile: { avatarUrl: '', name: '小林' }
    }
  })
}))

vi.mock('../uni-app/composables/useProfileAvatarEditor', () => ({
  useProfileAvatarEditor: () => ({
    uploadState: 'idle',
    errorMessage: '',
    isWechatMiniProgram: false,
    supportsWechatAvatarSelection: false,
    handleWechatAvatarChoice: vi.fn()
  })
}))

vi.mock('../uni-app/composables/useTrainingProgress', () => ({
  useTrainingProgress: () => ({
    state: { value: { status: 'loading' } },
    refresh: vi.fn()
  })
}))

vi.mock('../uni-app/composables/useReminderConsent', () => ({
  useReminderConsent: () => ({
    status: { value: 'not_requested' },
    syncState: { value: 'idle' },
    isWorking: { value: false },
    loadStatus: vi.fn(),
    authorize: vi.fn()
  })
}))

describe('station notifications', () => {
  beforeEach(() => {
    loadStationNotifications.mockReset().mockResolvedValue({
      count: 1,
      notifications: [
        {
          id: 17,
          notification_type: 'TRAINING_REMINDER',
          title: '晚间训练提醒',
          content: '今天已完成 1/3 项，还差 HIIT 跟练、楼梯训练。',
          is_read: false,
          reminder_slot: '18:00',
          action_target: '/pages/training/home',
          created_at: '2026-07-16T10:00:00Z'
        }
      ]
    })
    markStationNotificationRead.mockReset().mockResolvedValue(undefined)
    navigateTo.mockReset()
    reportBackendSyncError.mockReset()
    ;(globalThis as { uni?: unknown }).uni = { navigateTo }
  })

  it('loads unread count for the training-home entry', async () => {
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    const notifications = useStationNotifications()

    await notifications.refresh()

    expect(notifications.unreadCount.value).toBe(1)
    expect(notifications.state.value.status).toBe('ready')
    expect(notifications.state.value.notifications[0]).toMatchObject({
      createdAtLabel: '7月16日 18:00',
      readSyncFailed: false
    })
  })

  it('formats ISO instants deterministically in Asia/Shanghai', async () => {
    const { formatNotificationCreatedAt } = await import(
      '../uni-app/api/stationNotificationModels'
    )

    expect(formatNotificationCreatedAt('2026-07-16T10:00:00Z')).toBe('7月16日 18:00')
    expect(formatNotificationCreatedAt('2026-07-16T18:05:00+08:00')).toBe('7月16日 18:05')
    expect(formatNotificationCreatedAt('not-a-date')).toBe('时间待同步')
  })

  it('renders notification rows and opens a reminder at the three-mode overview', async () => {
    const NotificationPage = (await import('../uni-app/pages/notifications/index.vue')).default
    const wrapper = mount(NotificationPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' }
        }
      }
    })

    await flushPromises()
    expect(wrapper.text()).toContain('晚间训练提醒')
    expect(wrapper.text()).toContain('18:00')
    expect(wrapper.text()).toContain('HIIT 跟练、楼梯训练')
    expect(wrapper.text()).toContain('7月16日 18:00')

    await wrapper.get('[data-notification-id="17"]').trigger('click')
    await flushPromises()

    expect(markStationNotificationRead).toHaveBeenCalledWith(17)
    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/training/home?source=reminder'
    })
  })

  it('navigates to training and exposes a retry when read sync fails', async () => {
    markStationNotificationRead.mockRejectedValueOnce(new Error('network fail'))
    const NotificationPage = (await import('../uni-app/pages/notifications/index.vue')).default
    const wrapper = mount(NotificationPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' }
        }
      }
    })
    await flushPromises()

    await wrapper.get('[data-notification-id="17"]').trigger('click')
    await flushPromises()

    expect(reportBackendSyncError).toHaveBeenCalledWith(
      '提醒已读状态同步',
      expect.any(Error)
    )
    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/training/home?source=reminder'
    })
    expect(wrapper.text()).toContain('未读状态同步失败，点击可重试')

    markStationNotificationRead.mockResolvedValueOnce(undefined)
    await wrapper.get('[data-notification-id="17"]').trigger('click')
    await flushPromises()
    expect(markStationNotificationRead).toHaveBeenCalledTimes(2)
  })

  it('preserves encoded tracking, slot, and date when opening a station reminder', async () => {
    loadStationNotifications.mockResolvedValueOnce({
      count: 1,
      notifications: [{
        id: 17,
        notification_type: 'TRAINING_REMINDER',
        title: '晚间训练提醒',
        content: '今天还差两项训练。',
        is_read: true,
        reminder_slot: '18:00',
        action_target: '/pages/training/home?tracking=bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26&slot=18%3A00&date=2026-07-16',
        created_at: '2026-07-16T10:00:00Z'
      }]
    })
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    const notifications = useStationNotifications()
    await notifications.refresh()

    await notifications.open(notifications.state.value.notifications[0])

    expect(markStationNotificationRead).not.toHaveBeenCalled()
    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/training/home?tracking=bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26&slot=18%3A00&date=2026-07-16&source=reminder'
    })
  })

  it('offers an explicit retry after notification loading fails', async () => {
    loadStationNotifications.mockRejectedValueOnce(new Error('offline'))
    const NotificationPage = (await import('../uni-app/pages/notifications/index.vue')).default
    const wrapper = mount(NotificationPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' }
        }
      }
    })
    await flushPromises()

    expect(wrapper.get('.notification-page__retry').text()).toBe('重新加载')
    await wrapper.get('.notification-page__retry').trigger('click')
    await flushPromises()

    expect(loadStationNotifications).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('晚间训练提醒')
  })

  it('home header exposes the unread indicator and routes to the list', async () => {
    const HomePage = (await import('../uni-app/pages/training/home.vue')).default
    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeQuestPanel: true,
          DailyProgressCard: true,
          ReminderAuthorizationStatus: true,
          TrainingHomeFeatureCard: true,
          TrainingHomeCoachCard: true
        }
      }
    })

    await flushPromises()
    expect(wrapper.get('.home-header__bell-badge').text()).toBe('1')
    await wrapper.get('.home-header__bell-shell').trigger('click')
    expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/notifications/index' })
  })
})
