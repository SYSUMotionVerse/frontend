import { computed, readonly, shallowRef } from 'vue'
import { studentBackendSync } from '../api/studentBackend'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import {
  mapStationNotification,
  type StationNotificationViewModel
} from '../api/stationNotificationModels'
import { createRequestCache } from './useRequestCache'

export type StationNotificationState =
  | { status: 'loading'; notifications: StationNotificationViewModel[] }
  | { status: 'ready'; notifications: StationNotificationViewModel[] }
  | { status: 'error'; notifications: StationNotificationViewModel[]; message: string }

const state = shallowRef<StationNotificationState>({
  status: 'loading',
  notifications: []
})
const unreadCount = shallowRef(0)
const notificationsCache = createRequestCache({
  ttlMs: 60_000,
  load: () => studentBackendSync.loadStationNotifications()
})

export function useStationNotifications() {

  async function refresh(options: { force?: boolean } = {}) {
    if (state.value.status !== 'ready') {
      state.value = { status: 'loading', notifications: state.value.notifications }
    }
    try {
      const result = await notificationsCache.get(options)
      unreadCount.value = result.count
      state.value = {
        status: 'ready',
        notifications: result.notifications.map(mapStationNotification)
      }
    } catch (error) {
      reportBackendSyncError('站内提醒同步', error)
      state.value = {
        status: 'error',
        notifications: [],
        message: '提醒暂时无法同步，请稍后重试。'
      }
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
    uni.navigateTo({
      url: `${actionTarget}${separator}source=reminder`
    })
  }

  function openList() {
    uni.navigateTo({ url: '/pages/notifications/index' })
  }

  return {
    state: readonly(state),
    unreadCount: computed(() => unreadCount.value),
    refresh,
    invalidate: notificationsCache.invalidate,
    open,
    openList
  }
}
