import { computed, readonly, shallowRef } from 'vue'
import { studentBackendSync } from '../api/studentBackend'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import {
  mapStationNotification,
  type StationNotificationViewModel
} from '../api/stationNotificationModels'
import { createRequestCache } from './useRequestCache'

export type StationNotificationState =
  | {
      status: 'loading'
      notifications: StationNotificationViewModel[]
      nextPage: string | null
    }
  | {
      status: 'ready'
      notifications: StationNotificationViewModel[]
      nextPage: string | null
    }
  | {
      status: 'error'
      notifications: StationNotificationViewModel[]
      nextPage: string | null
      message: string
    }

const state = shallowRef<StationNotificationState>({
  status: 'loading',
  notifications: [],
  nextPage: null
})
const unreadCount = shallowRef(0)
const isLoadingMore = shallowRef(false)
const loadMoreError = shallowRef('')
let notificationRequestGeneration = 0
const notificationsCache = createRequestCache({
  ttlMs: 60_000,
  load: () => studentBackendSync.loadStationNotifications()
})

export function useStationNotifications() {

  async function refresh(options: { force?: boolean } = {}) {
    if (!options.force && state.value.status === 'ready' && notificationsCache.hasValue()) {
      return
    }
    const requestGeneration = ++notificationRequestGeneration
    if (state.value.status !== 'ready') {
      state.value = {
        status: 'loading',
        notifications: state.value.notifications,
        nextPage: state.value.nextPage
      }
    }
    loadMoreError.value = ''
    try {
      const result = await notificationsCache.get(options)
      if (requestGeneration !== notificationRequestGeneration) return
      unreadCount.value = result.count
      state.value = {
        status: 'ready',
        notifications: result.notifications.map(mapStationNotification),
        nextPage: result.nextPage
      }
    } catch (error) {
      if (requestGeneration !== notificationRequestGeneration) return
      reportBackendSyncError('站内提醒同步', error)
      state.value = {
        status: 'error',
        notifications: state.value.notifications,
        nextPage: state.value.nextPage,
        message: '提醒暂时无法同步，请稍后重试。'
      }
    }
  }

  async function loadMore() {
    const currentState = state.value
    if (
      currentState.status !== 'ready'
      || !currentState.nextPage
      || isLoadingMore.value
    ) {
      return
    }

    isLoadingMore.value = true
    loadMoreError.value = ''
    const requestGeneration = notificationRequestGeneration
    try {
      const result = await studentBackendSync.loadStationNotifications(currentState.nextPage)
      if (requestGeneration !== notificationRequestGeneration) return
      const existingIds = new Set(currentState.notifications.map(notification => notification.id))
      state.value = {
        status: 'ready',
        notifications: [
          ...currentState.notifications,
          ...result.notifications
            .map(mapStationNotification)
            .filter(notification => !existingIds.has(notification.id))
        ],
        nextPage: result.nextPage
      }
    } catch (error) {
      reportBackendSyncError('更多站内提醒同步', error)
      loadMoreError.value = '更多提醒暂时无法同步，请稍后重试。'
    } finally {
      isLoadingMore.value = false
    }
  }

  async function open(notification: StationNotificationViewModel) {
    if (!notification.isRead) {
      try {
        await studentBackendSync.markStationNotificationRead(notification.id)
        notificationsCache.invalidate()
        unreadCount.value = Math.max(0, unreadCount.value - 1)
        state.value = {
          ...state.value,
          notifications: state.value.notifications.map(item =>
            item.id === notification.id
              ? { ...item, isRead: true, readSyncFailed: false }
              : item
          )
        }
      } catch (error) {
        reportBackendSyncError('提醒已读状态同步', error)
        state.value = {
          ...state.value,
          notifications: state.value.notifications.map(item =>
            item.id === notification.id ? { ...item, readSyncFailed: true } : item
          )
        }
      }
    }

    const actionTarget = notification.actionTarget.trim() || '/pages/training/home'
    const separator = actionTarget.includes('?') ? '&' : '?'
    const targetUrl = `${actionTarget}${separator}source=reminder`
    const targetPath = actionTarget.split('?')[0]
    const primaryTabPaths = new Set([
      '/pages/training/home',
      '/pages/training/select',
      '/pages/growth/index'
    ])

    if (primaryTabPaths.has(targetPath)) {
      if (actionTarget.includes('?')) {
        uni.reLaunch({ url: targetUrl })
        return
      }
      uni.switchTab({ url: targetPath })
      return
    }

    uni.navigateTo({ url: targetUrl })
  }

  function openList() {
    uni.navigateTo({ url: '/pages/notifications/index' })
  }

  function invalidate() {
    notificationRequestGeneration += 1
    notificationsCache.invalidate()
    loadMoreError.value = ''
  }

  return {
    state: readonly(state),
    unreadCount: computed(() => unreadCount.value),
    refresh,
    loadMore,
    hasMore: computed(() => Boolean(state.value.nextPage)),
    isLoadingMore: readonly(isLoadingMore),
    loadMoreError: readonly(loadMoreError),
    invalidate,
    open,
    openList
  }
}
