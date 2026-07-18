import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PendingShortQuestionnaireSubmission } from '../uni-app/platform/pendingShortQuestionnaires'

describe('pending short questionnaire storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('survives a store recreation through mini-program storage', async () => {
    let stored: unknown = []
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      })
    })

    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const submission: PendingShortQuestionnaireSubmission = {
      sessionId: 'session-1',
      response: { energyLevel: 4, confidence: 5, enjoyment: 3 },
      queuedAt: '2026-07-18T10:00:00.000Z'
    }

    createPendingShortQuestionnaireStore().save(submission)

    expect(createPendingShortQuestionnaireStore().list()).toEqual([submission])
  })

  it('keeps the response pending when no backend endpoint exists', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>()
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId))
    }
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true },
      {},
      { pendingShortQuestionnaires }
    )

    await expect(sync.syncShortQuestionnaire({
      sessionId: 'session-1',
      energyLevel: 4,
      confidence: 5,
      enjoyment: 3
    })).resolves.toEqual({
      synced: false,
      reason: 'pending-backend-endpoint'
    })

    expect(entries.get('session-1')?.response).toEqual({
      energyLevel: 4,
      confidence: 5,
      enjoyment: 3
    })
  })

  it('removes the pending response after a typed backend submission succeeds', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>()
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId))
    }
    const submitShortQuestionnaire = vi.fn().mockResolvedValue(undefined)
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        submitShortQuestionnaire
      },
      {},
      { pendingShortQuestionnaires }
    )

    await expect(sync.syncShortQuestionnaire({
      sessionId: 'session-2',
      energyLevel: 3,
      confidence: 4,
      enjoyment: 5
    })).resolves.toEqual({ synced: true })
    expect(submitShortQuestionnaire).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-2'
    }))
    expect(entries.has('session-2')).toBe(false)
  })
})
