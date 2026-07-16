import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendRequestError } from '../uni-app/api/backendClient'

const resolveReminderReturn = vi.fn()
const reportBackendSyncError = vi.fn()

vi.mock('../uni-app/api/studentBackend', async importOriginal => {
  const actual = await importOriginal<typeof import('../uni-app/api/studentBackend')>()
  return {
    ...actual,
    studentBackendSync: { resolveReminderReturn }
  }
})

vi.mock('../uni-app/api/reportBackendSyncError', () => ({
  reportBackendSyncError
}))

describe('trusted reminder return', () => {
  beforeEach(() => {
    resolveReminderReturn.mockReset().mockResolvedValue({
      resolved: true,
      slot: '18:00',
      local_date: '2026-07-16',
      first_returned_at: '2026-07-16T10:05:00Z'
    })
    reportBackendSyncError.mockReset()
  })

  it('accepts an opaque route target with explicit slot and date', async () => {
    const { parseReminderReturnQuery } = await import('../uni-app/platform/reminders')

    expect(parseReminderReturnQuery({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      date: '2026-07-16'
    })).toEqual({
      trackingId: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      localDate: '2026-07-16'
    })
  })

  it('treats incomplete, malformed, and manual routes as having no trusted return', async () => {
    const { parseReminderReturnQuery } = await import('../uni-app/platform/reminders')

    expect(parseReminderReturnQuery({})).toBeNull()
    expect(parseReminderReturnQuery({
      tracking: '17',
      slot: '18:00',
      date: '2026-07-16'
    })).toBeNull()
    expect(parseReminderReturnQuery({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: 'noon',
      date: '2026-07-16'
    })).toBeNull()
    expect(parseReminderReturnQuery({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '12:00',
      date: '2026-02-30'
    })).toBeNull()
  })

  it('resolves a captured target once and allows the caller to refresh current progress afterward', async () => {
    const { useReminderReturn } = await import('../uni-app/composables/useReminderReturn')
    const reminderReturn = useReminderReturn()
    const refreshCurrentProgress = vi.fn()

    reminderReturn.capture({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      date: '2026-07-16'
    })
    await reminderReturn.resolvePending()
    await refreshCurrentProgress()
    await reminderReturn.resolvePending()

    expect(resolveReminderReturn).toHaveBeenCalledTimes(1)
    expect(resolveReminderReturn).toHaveBeenCalledWith({
      trackingId: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      localDate: '2026-07-16'
    })
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(1)
    expect(reminderReturn.state.value.status).toBe('resolved')
  })

  it('does not call the resolution API for manual entry or malformed query values', async () => {
    const { useReminderReturn } = await import('../uni-app/composables/useReminderReturn')
    const manual = useReminderReturn()
    const malformed = useReminderReturn()

    manual.capture({})
    malformed.capture({ tracking: '17', slot: '18:00', date: '2026-07-16' })
    await manual.resolvePending()
    await malformed.resolvePending()

    expect(resolveReminderReturn).not.toHaveBeenCalled()
    expect(manual.state.value.status).toBe('idle')
    expect(malformed.state.value.status).toBe('idle')
  })

  it.each([404, 410])('clears and rejects a terminal %s return response', async statusCode => {
    resolveReminderReturn.mockRejectedValueOnce(
      new BackendRequestError('Reminder return is unavailable.', statusCode)
    )
    const { useReminderReturn } = await import('../uni-app/composables/useReminderReturn')
    const reminderReturn = useReminderReturn()

    reminderReturn.capture({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '12:00',
      date: '2026-07-16'
    })
    await expect(reminderReturn.resolvePending()).resolves.toBeUndefined()
    await reminderReturn.resolvePending()

    expect(resolveReminderReturn).toHaveBeenCalledTimes(1)
    expect(reminderReturn.state.value.status).toBe('rejected')
    expect(reportBackendSyncError).toHaveBeenCalledWith(
      '提醒回流同步',
      expect.objectContaining({ statusCode })
    )
  })

  it.each([
    ['network failure', new Error('request:fail timeout')],
    ['server failure', new BackendRequestError('Service unavailable.', 503)]
  ])('retains the target after a %s and retries on a later show', async (_label, error) => {
    resolveReminderReturn
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ resolved: true })
    const { useReminderReturn } = await import('../uni-app/composables/useReminderReturn')
    const reminderReturn = useReminderReturn()

    reminderReturn.capture({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '12:00',
      date: '2026-07-16'
    })
    await reminderReturn.resolvePending()

    expect(reminderReturn.state.value.status).toBe('pending')

    await reminderReturn.resolvePending()
    await reminderReturn.resolvePending()

    expect(resolveReminderReturn).toHaveBeenCalledTimes(2)
    expect(reminderReturn.state.value.status).toBe('resolved')
  })

  it('does not submit the same target twice while resolution is in flight', async () => {
    let completeResolution: (() => void) | undefined
    resolveReminderReturn.mockImplementationOnce(() => new Promise<void>(resolve => {
      completeResolution = resolve
    }))
    const { useReminderReturn } = await import('../uni-app/composables/useReminderReturn')
    const reminderReturn = useReminderReturn()

    reminderReturn.capture({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      date: '2026-07-16'
    })
    const firstShow = reminderReturn.resolvePending()
    const secondShow = reminderReturn.resolvePending()

    expect(resolveReminderReturn).toHaveBeenCalledTimes(1)
    completeResolution?.()
    await Promise.all([firstShow, secondShow])

    expect(reminderReturn.state.value.status).toBe('resolved')
  })

  it('authenticates before posting the return contract through the backend adapter', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const calls: string[] = []
    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession: vi.fn(async () => { calls.push('auth') }),
      resolveReminderReturn: vi.fn(async () => {
        calls.push('resolve')
        return {
          resolved: true as const,
          slot: '18:00' as const,
          local_date: '2026-07-16',
          first_returned_at: '2026-07-16T10:05:00Z'
        }
      })
    })

    await sync.resolveReminderReturn({
      trackingId: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      localDate: '2026-07-16'
    })

    expect(calls).toEqual(['auth', 'resolve'])
  })
})
