import type { StudentAppState } from '../../domain/student/types'

export type ReminderSlot = '12:00' | '18:00'

export interface ReminderReturnTarget {
  trackingId: string
  slot: ReminderSlot
  localDate: string
}

function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export function parseReminderReturnQuery(
  query: Record<string, string | undefined>
): ReminderReturnTarget | null {
  const trackingId = query.tracking?.trim() ?? ''
  const slot = query.slot
  const localDate = query.date?.trim() ?? ''
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trackingId)

  if (!isUuid || (slot !== '12:00' && slot !== '18:00') || !isIsoCalendarDate(localDate)) {
    return null
  }

  return { trackingId, slot, localDate }
}

export function resolveReminderSource(query: Record<string, string | undefined>) {
  return query.source === 'reminder' ? ('wechat-reminder' satisfies NonNullable<StudentAppState['reminderSource']>) : null
}
