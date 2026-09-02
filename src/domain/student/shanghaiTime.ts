const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

export function toShanghaiDate(value: string | number | Date = new Date()): string {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10)
}
