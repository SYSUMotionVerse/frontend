import type { StudentAppState } from '../../domain/student/types'

export function resolveReminderSource(query: Record<string, string | undefined>) {
  return query.source === 'reminder' ? ('wechat-reminder' satisfies NonNullable<StudentAppState['reminderSource']>) : null
}
