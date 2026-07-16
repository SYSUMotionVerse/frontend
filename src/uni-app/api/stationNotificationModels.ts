import type { BackendStationNotification } from './studentBackendTypes'

export interface StationNotificationViewModel {
  id: number
  title: string
  content: string
  isRead: boolean
  slot: '12:00' | '18:00' | null
  actionTarget: string
  createdAtLabel: string
  readSyncFailed: boolean
}

export function formatNotificationCreatedAt(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/
  )
  if (!match) {
    return '时间待同步'
  }

  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(part => Number(part ?? 0))
  const sourcePartsAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const validationDate = new Date(sourcePartsAsUtc)
  const isValidCalendarTime = (
    validationDate.getUTCFullYear() === year
    && validationDate.getUTCMonth() === month - 1
    && validationDate.getUTCDate() === day
    && validationDate.getUTCHours() === hour
    && validationDate.getUTCMinutes() === minute
    && validationDate.getUTCSeconds() === second
  )
  if (!isValidCalendarTime) {
    return '时间待同步'
  }

  const zone = match[7]
  let sourceOffsetMinutes = 8 * 60
  if (zone === 'Z') {
    sourceOffsetMinutes = 0
  } else if (zone) {
    const offsetHours = Number(zone.slice(1, 3))
    const offsetMinutes = Number(zone.slice(4, 6))
    if (offsetHours > 23 || offsetMinutes > 59) {
      return '时间待同步'
    }
    const sign = zone.startsWith('-') ? -1 : 1
    sourceOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes)
  }

  const instantMs = sourcePartsAsUtc - sourceOffsetMinutes * 60_000
  const shanghaiDate = new Date(instantMs + 8 * 60 * 60_000)
  const shanghaiMonth = shanghaiDate.getUTCMonth() + 1
  const shanghaiDay = shanghaiDate.getUTCDate()
  const shanghaiHour = shanghaiDate.getUTCHours().toString().padStart(2, '0')
  const shanghaiMinute = shanghaiDate.getUTCMinutes().toString().padStart(2, '0')
  return `${shanghaiMonth}月${shanghaiDay}日 ${shanghaiHour}:${shanghaiMinute}`
}

export function mapStationNotification(
  notification: BackendStationNotification
): StationNotificationViewModel {
  return {
    id: notification.id,
    title: notification.title,
    content: notification.content,
    isRead: notification.is_read,
    slot: notification.reminder_slot,
    actionTarget: notification.action_target,
    createdAtLabel: formatNotificationCreatedAt(notification.created_at),
    readSyncFailed: false
  }
}
