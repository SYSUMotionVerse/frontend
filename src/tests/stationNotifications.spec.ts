import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadStationNotifications = vi.fn()
const markStationNotificationRead = vi.fn()
const markAllStationNotificationsRead = vi.fn()
const navigateTo = vi.fn()
const switchTab = vi.fn()
const reLaunch = vi.fn()
const reportBackendSyncError = vi.fn()
const topUpQuota = vi.fn()
const maybePromptThenAuthorize = vi.fn().mockResolvedValue(true)
const promptDismissed = { value: false }

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onHide: vi.fn(),
  onPullDownRefresh: vi.fn(),
  onShow: vi.fn((callback: () => unknown) => callback())
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    loadStationNotifications,
    markStationNotificationRead,
    markAllStationNotificationsRead
  }
}))

vi.mock('../uni-app/api/reportBackendSyncError', () => ({
  reportBackendSyncError
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    setReminderSource: vi.fn(),
    state: {
      profile: { name: '小林' }
    }
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
    status: { value: 'accepted' },
    syncState: { value: 'idle' },
    isWorking: { value: false },
    loadStatus: vi.fn(),
    authorize: vi.fn(),
    maybePromptThenAuthorize,
    promptDismissed,
    topUpQuota
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
          content: '今天已完成 1/3 项，还差自重抗阻跟练、楼梯训练。',
          is_read: false,
          reminder_slot: '18:00',
          action_target: '/pages/training/home',
          created_at: '2026-07-16T10:00:00Z'
        }
      ]
    })
    markStationNotificationRead.mockReset().mockResolvedValue(undefined)
    markAllStationNotificationsRead.mockReset().mockResolvedValue({ synced: true })
    navigateTo.mockReset()
    switchTab.mockReset()
    reLaunch.mockReset()
    reportBackendSyncError.mockReset()
    topUpQuota.mockReset().mockResolvedValue(undefined)
    maybePromptThenAuthorize.mockReset().mockResolvedValue(true)
    promptDismissed.value = false
    ;(globalThis as { uni?: unknown }).uni = { navigateTo, reLaunch, switchTab }
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

  it('keeps the ready notification state stable while its request cache is fresh', async () => {
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    const notifications = useStationNotifications()
    notifications.invalidate()
    loadStationNotifications.mockClear()

    await notifications.refresh()
    const readyState = notifications.state.value
    await notifications.refresh()

    expect(loadStationNotifications).toHaveBeenCalledTimes(1)
    expect(notifications.state.value).toBe(readyState)
  })

  it('loads more notifications only after the user requests the next page', async () => {
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    const notifications = useStationNotifications()
    notifications.invalidate()
    loadStationNotifications
      .mockResolvedValueOnce({
        count: 1,
        notifications: [
          {
            id: 17,
            notification_type: 'TRAINING_REMINDER',
            title: '晚间训练提醒',
            content: '今天已完成 1/3 项。',
            is_read: false,
            reminder_slot: '18:00',
            action_target: '/pages/training/home',
            created_at: '2026-07-16T10:00:00Z'
          }
        ],
        nextPage: '/notifications/messages/?notification_type=TRAINING_REMINDER&page=2'
      })
      .mockResolvedValueOnce({
        count: 0,
        notifications: [
          {
            id: 16,
            notification_type: 'TRAINING_REMINDER',
            title: '午间训练提醒',
            content: '记得活动一下。',
            is_read: true,
            reminder_slot: '12:00',
            action_target: '/pages/training/home',
            created_at: '2026-07-16T04:00:00Z'
          }
        ],
        nextPage: null
      })

    await notifications.refresh({ force: true })

    expect(loadStationNotifications).toHaveBeenCalledTimes(1)
    expect(notifications.hasMore.value).toBe(true)
    expect(notifications.state.value.notifications).toHaveLength(1)

    await notifications.loadMore()

    expect(loadStationNotifications).toHaveBeenLastCalledWith(
      '/notifications/messages/?notification_type=TRAINING_REMINDER&page=2'
    )
    expect(notifications.state.value.notifications.map(item => item.id)).toEqual([17, 16])
    expect(notifications.hasMore.value).toBe(false)
    notifications.invalidate()
  })

  it('formats ISO instants deterministically in Asia/Shanghai', async () => {
    const { formatNotificationCreatedAt } = await import(
      '../uni-app/api/stationNotificationModels'
    )

    expect(formatNotificationCreatedAt('2026-07-16T10:00:00Z')).toBe('7月16日 18:00')
    expect(formatNotificationCreatedAt('2026-07-16T18:05:00+08:00')).toBe('7月16日 18:05')
    expect(formatNotificationCreatedAt('not-a-date')).toBe('时间待同步')
  })

  it('keeps daily questionnaire reminder targets separate from training', async () => {
    const { mapStationNotification } = await import('../uni-app/api/stationNotificationModels')
    const notification = mapStationNotification({ id: 18, notification_type: 'SCALE_REMINDER', title: '问卷提醒', content: '填写今日问卷',
      is_read: false, reminder_slot: '09:00', action_target: '/pages/training/home?slot=09%3A00', created_at: '2026-10-13T01:00:00Z' })
    expect(notification.actionTarget).toBe('/pages/training/home?slot=09%3A00')
    expect(notification.actionLabel).toBe('填写问卷')
  })

  it('renders one timestamp and opens a reminder at the training selection page', async () => {
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
    expect(wrapper.text()).toContain('自重抗阻跟练、楼梯训练')
    expect(wrapper.text()).toContain('7月16日 18:00')
    expect(wrapper.find('.notification-row__slot').exists()).toBe(false)
    expect(wrapper.get('.notification-row__action').text()).toBe('去跟练')

    await wrapper.get('[data-notification-id="17"]').trigger('click')
    await flushPromises()

    expect(markStationNotificationRead).toHaveBeenCalledWith(17)
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/training/select'
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
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/training/select'
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
    notifications.invalidate()
    await notifications.refresh({ force: true })

    await notifications.open(notifications.state.value.notifications[0])

    expect(markStationNotificationRead).not.toHaveBeenCalled()
    expect(reLaunch).toHaveBeenCalledWith({
      url: '/pages/training/select?tracking=bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26&slot=18%3A00&date=2026-07-16&source=reminder'
    })
  })

  it('offers an explicit retry after notification loading fails', async () => {
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    useStationNotifications().invalidate()
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

  it('marks all pages read through one request and clears the shared unread count', async () => {
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    const notifications = useStationNotifications()
    notifications.invalidate()
    const NotificationPage = (await import('../uni-app/pages/notifications/index.vue')).default
    const wrapper = mount(NotificationPage, { global: { stubs: { UniTrainingPageShell: { template: '<div><slot /></div>' } } } })
    await flushPromises()
    await wrapper.get('[data-notification-read-all]').trigger('click')
    await flushPromises()
    expect(markAllStationNotificationsRead).toHaveBeenCalledTimes(1)
    expect(notifications.unreadCount.value).toBe(0)
    expect(notifications.state.value.notifications.every(item => item.isRead)).toBe(true)
    expect(wrapper.get('[data-notification-read-all]').attributes('disabled')).toBeDefined()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(switchTab).not.toHaveBeenCalled()
  })

  it('retains unread state and allows retry after batch read fails', async () => {
    const { useStationNotifications } = await import('../uni-app/composables/useStationNotifications')
    const notifications = useStationNotifications()
    notifications.invalidate()
    await notifications.refresh({ force: true })
    markAllStationNotificationsRead.mockRejectedValueOnce(new Error('offline'))
    await notifications.markAllRead()
    expect(notifications.unreadCount.value).toBe(1)
    expect(notifications.state.value.notifications[0].isRead).toBe(false)
    expect(notifications.markAllReadError.value).toContain('重试')
    await notifications.markAllRead()
    expect(notifications.unreadCount.value).toBe(0)
    expect(notifications.markAllReadError.value).toBe('')
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
    expect(wrapper.get('.home-header__bell-shell').find('.home-header__bell-badge').exists()).toBe(false)
    await wrapper.get('.home-header__bell-shell').trigger('click')
    expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/notifications/index' })
    expect(topUpQuota).toHaveBeenCalledTimes(1)
  })
})
