import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PendingShortQuestionnaireSubmission } from '../uni-app/platform/pendingShortQuestionnaires'
import type { PendingTrainingSubmission } from '../uni-app/platform/pendingTrainingSubmissions'

describe('pending short questionnaire storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('survives a store recreation through mini-program storage', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
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
      response: { feelingScale: 4, feltArousalScale: 5},
      queuedAt: '2026-07-18T10:00:00.000Z'
    }

    createPendingShortQuestionnaireStore({ now: () => now }).save(submission)

    expect(createPendingShortQuestionnaireStore({ now: () => now }).list()).toEqual([submission])
  })

  it('expires stale entries and bounds the durable queue', async () => {
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
    const store = createPendingShortQuestionnaireStore({
      now: () => new Date('2026-07-19T00:00:00.000Z'),
      retentionMs: 24 * 60 * 60 * 1000,
      maxEntries: 2
    })

    store.save({
      sessionId: 'expired',
      response: { feelingScale: 1, feltArousalScale: 1},
      queuedAt: '2026-07-17T00:00:00.000Z'
    })
    for (const sessionId of ['recent-1', 'recent-2', 'recent-3']) {
      store.save({
        sessionId,
        response: { feelingScale: 3, feltArousalScale: 4},
        queuedAt: '2026-07-19T00:00:00.000Z'
      })
    }

    expect(store.list().map(item => item.sessionId)).toEqual(['recent-2', 'recent-3'])
  })

  it('keeps the response pending when no backend endpoint exists', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>()
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true },
      {},
      { pendingShortQuestionnaires }
    )

    await expect(sync.syncShortQuestionnaire({
      sessionId: 'session-1',
      feelingScale: 4,
      feltArousalScale: 5
    })).resolves.toEqual({
      synced: false,
      reason: 'pending-backend-endpoint'
    })

    expect(entries.get('session-1')?.response).toEqual({
      feelingScale: 4,
      feltArousalScale: 5
    })
  })

  it('removes the pending response after a typed backend submission succeeds', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>()
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }
    const submitShortQuestionnaire = vi.fn().mockResolvedValue({
      id: 2,
      user: 1,
      training_session_id: 'session-2',
      feeling_scale: 3,
      felt_arousal_scale: 4,
      created_at: '2026-07-19T10:00:00Z',
      updated_at: '2026-07-19T10:00:00Z'
    })
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
      feelingScale: 3,
      feltArousalScale: 4
    })).resolves.toEqual({ synced: true })
    expect(submitShortQuestionnaire).toHaveBeenCalledWith({
      training_session_id: 'session-2',
      feeling_scale: 3,
      felt_arousal_scale: 4
    })
    expect(entries.has('session-2')).toBe(false)
  })

  it('retries every durable response and removes only successful submissions', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>([
      ['success', {
        sessionId: 'success',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T10:00:00.000Z'
      }],
      ['failure', {
        sessionId: 'failure',
        response: { feelingScale: 2, feltArousalScale: 3},
        queuedAt: '2026-07-18T10:01:00.000Z'
      }]
    ])
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }
    const submitShortQuestionnaire = vi.fn(async (payload: { training_session_id: string }) => {
      if (payload.training_session_id === 'failure') {
        throw new Error('offline')
      }
      return {
        id: 3,
        user: 1,
        ...payload,
        feeling_scale: 4,
        felt_arousal_scale: 5,
        created_at: '2026-07-19T10:00:00Z',
        updated_at: '2026-07-19T10:00:00Z'
      }
    })
    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true, ensureSession, submitShortQuestionnaire },
      {},
      { pendingShortQuestionnaires }
    )

    await expect(sync.retryPendingShortQuestionnaires()).resolves.toEqual({
      attempted: 2,
      succeeded: 1
    })
    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(entries.has('success')).toBe(false)
    expect(entries.has('failure')).toBe(true)
  })

  it('waits for the matching training upload before retrying its questionnaire', async () => {
    const shortEntries = new Map<string, PendingShortQuestionnaireSubmission>([[
      'ordered-session',
      {
        sessionId: 'ordered-session',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T10:01:00.000Z'
      }
    ]])
    const trainingEntries = new Map<string, PendingTrainingSubmission>([[
      'ordered-session',
      {
        kind: 'visual',
        sessionId: 'ordered-session',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: '2026-07-18T10:00:00.000Z'
      }
    ]])
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...shortEntries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => shortEntries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => shortEntries.delete(sessionId)),
      clear: vi.fn(() => shortEntries.clear())
    }
    const pendingSubmissions = {
      list: vi.fn(() => [...trainingEntries.values()]),
      save: vi.fn((entry: PendingTrainingSubmission) => trainingEntries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => trainingEntries.delete(sessionId)),
      clear: vi.fn(() => trainingEntries.clear())
    }
    const submitShortQuestionnaire = vi.fn().mockResolvedValue({ id: 1 })
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        submitShortQuestionnaire
      },
      {},
      { pendingShortQuestionnaires, pendingSubmissions }
    )

    await expect(sync.retryPendingShortQuestionnaires()).resolves.toEqual({
      attempted: 1,
      succeeded: 0
    })
    expect(submitShortQuestionnaire).not.toHaveBeenCalled()

    trainingEntries.clear()
    await expect(sync.retryPendingShortQuestionnaires()).resolves.toEqual({
      attempted: 1,
      succeeded: 1
    })
    expect(submitShortQuestionnaire).toHaveBeenCalledTimes(1)
  })

  it('clears all pending responses via the clear API', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
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
    const store = createPendingShortQuestionnaireStore({ now: () => now })
    store.save({
      sessionId: 'session-a',
      response: { feelingScale: 4, feltArousalScale: 5},
      queuedAt: '2026-07-18T10:00:00.000Z'
    })
    store.save({
      sessionId: 'session-b',
      response: { feelingScale: 2, feltArousalScale: 3},
      queuedAt: '2026-07-18T11:00:00.000Z'
    })
    expect(store.list()).toHaveLength(2)

    store.clear()

    expect(store.list()).toEqual([])
    expect(stored).toEqual([])
  })

  it('silently drops malformed and legacy entries during read', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid entry
      {
        sessionId: 'valid',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // malformed: missing response
      { sessionId: 'no-response', queuedAt: '2026-07-18T10:00:00.000Z' },
      // malformed: invalid queuedAt
      {
        sessionId: 'bad-date',
        response: { feelingScale: 1, feltArousalScale: 1},
        queuedAt: 'not-a-date'
      },
      // malformed: empty sessionId
      {
        sessionId: '',
        response: { feelingScale: 1, feltArousalScale: 1},
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // malformed: not an object
      'string-entry',
      null,
      // legacy: non-numeric feelingScale
      {
        sessionId: 'legacy',
        response: { feelingScale: 'high', feltArousalScale: 5},
        queuedAt: '2026-07-18T10:00:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const store = createPendingShortQuestionnaireStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    // The sanitised list should be written back to storage
    expect(written).toEqual(items)
  })

  it('rejects out-of-range and non-integer response values', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid entry
      {
        sessionId: 'valid',
        response: { feelingScale: 1, feltArousalScale: 5},
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // out-of-range: feelingScale -6
      {
        sessionId: 'zero-energy',
        response: { feelingScale: -6, feltArousalScale: 3},
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // out-of-range: feltArousalScale 7
      {
        sessionId: 'six-feltArousalScale',
        response: { feelingScale: 3, feltArousalScale: 7},
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // non-integer FAS value
      {
        sessionId: 'fractional-enjoyment',
        response: { feelingScale: 3, feltArousalScale: 3.5},
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // value below the FS lower bound
      {
        sessionId: 'negative',
        response: { feelingScale: -6, feltArousalScale: 3},
        queuedAt: '2026-07-18T10:00:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const store = createPendingShortQuestionnaireStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    expect(written).toEqual(items)
  })

  it('replaces a corrupt non-array root storage value', async () => {
    let stored: unknown = 'corrupt-string-value'
    const setSpy = vi.fn((_key: string, value: unknown) => {
      stored = value
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: setSpy
    })
    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const store = createPendingShortQuestionnaireStore()

    const items = store.list()

    expect(items).toEqual([])
    // The corrupt root must be replaced with a clean empty array
    expect(setSpy).toHaveBeenCalledWith(
      'sport-snack:pending-short-questionnaires',
      []
    )
  })

  it('replaces a null root storage value', async () => {
    let stored: unknown = null
    const setSpy = vi.fn((_key: string, value: unknown) => {
      stored = value
    })
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: setSpy
    })
    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const store = createPendingShortQuestionnaireStore()

    store.list()

    expect(setSpy).toHaveBeenCalledWith(
      'sport-snack:pending-short-questionnaires',
      []
    )
  })

  it('drops future-dated entries beyond clock skew allowance', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid recent entry
      {
        sessionId: 'valid',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T11:59:30.000Z'
      },
      // future-dated: 2 minutes ahead (beyond 60s skew)
      {
        sessionId: 'future-far',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T12:02:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const store = createPendingShortQuestionnaireStore({
      now: () => now,
      maxClockSkewMs: 60 * 1000
    })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    expect(written).toEqual(items)
  })

  it('keeps entries within the clock skew allowance', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // entry 30 seconds in the future (within 60s skew)
      {
        sessionId: 'near-future',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T12:00:30.000Z'
      }
    ]
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn()
    })
    const { createPendingShortQuestionnaireStore } = await import(
      '../uni-app/platform/pendingShortQuestionnaires'
    )
    const store = createPendingShortQuestionnaireStore({
      now: () => now,
      maxClockSkewMs: 60 * 1000
    })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['near-future'])
  })

  it('throws when syncShortQuestionnaire receives out-of-range values', async () => {
    const pendingShortQuestionnaires = {
      list: vi.fn(() => []),
      save: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true },
      {},
      { pendingShortQuestionnaires }
    )

    await expect(sync.syncShortQuestionnaire({
      sessionId: 'session-x',
      feelingScale: -6,
      feltArousalScale: 3
    })).rejects.toThrow('FS/FAS domains')

    expect(pendingShortQuestionnaires.save).not.toHaveBeenCalled()
  })

  it('throws when syncShortQuestionnaire receives non-integer values', async () => {
    const pendingShortQuestionnaires = {
      list: vi.fn(() => []),
      save: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true },
      {},
      { pendingShortQuestionnaires }
    )

    await expect(sync.syncShortQuestionnaire({
      sessionId: 'session-y',
      feelingScale: 3.5,
      feltArousalScale: 3
    })).rejects.toThrow('FS/FAS domains')

    expect(pendingShortQuestionnaires.save).not.toHaveBeenCalled()
  })

  it('serializes two syncs for the same session so the second save is not deleted by the first remove', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>()
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }

    let resolveFirst: () => void
    const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve })
    let callCount = 0
    const submitShortQuestionnaire = vi.fn(async (payload: { training_session_id: string }) => {
      callCount++
      if (callCount === 1) {
        await firstPromise
      }
      return { id: callCount, user: 1, feeling_scale: 1, felt_arousal_scale: 1, ...payload, created_at: '2026-07-19T10:00:00Z', updated_at: '2026-07-19T10:00:00Z' }
    })

    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true, ensureSession: vi.fn().mockResolvedValue(undefined), submitShortQuestionnaire },
      {},
      { pendingShortQuestionnaires }
    )

    // First submit for session-A — saves {1,1,1}, blocks on network
    const firstSync = sync.syncShortQuestionnaire({
      sessionId: 'session-A',
      feelingScale: 1,
      feltArousalScale: 1
    })
    await vi.waitFor(() => expect(submitShortQuestionnaire).toHaveBeenCalledTimes(1))

    // Second submit for the same session — queued behind the first
    const secondSync = sync.syncShortQuestionnaire({
      sessionId: 'session-A',
      feelingScale: 5,
      feltArousalScale: 5
    })

    // Release the first network call — it succeeds and removes session-A
    resolveFirst!()

    const firstResult = await firstSync
    expect(firstResult.synced).toBe(true)

    // The second sync runs after the first: saves {5,5,5}, submits, removes
    const secondResult = await secondSync
    expect(secondResult.synced).toBe(true)

    // The key invariant: the first sync's remove did NOT delete the second sync's save.
    // Serialization ensured: save1, submit1, remove1, save2, submit2, remove2.
    const saveCalls = pendingShortQuestionnaires.save.mock.calls
    const removeCalls = pendingShortQuestionnaires.remove.mock.calls
    expect(saveCalls).toHaveLength(2)
    expect(removeCalls).toHaveLength(2)
    expect(saveCalls[0][0].response).toEqual({ feelingScale: 1, feltArousalScale: 1})
    expect(saveCalls[1][0].response).toEqual({ feelingScale: 5, feltArousalScale: 5})
  })

  it('does not make a new session wait for a blocked historical retry', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>([
      ['historical-session', {
        sessionId: 'historical-session',
        response: { feelingScale: 1, feltArousalScale: 2},
        queuedAt: '2026-07-18T10:00:00.000Z'
      }]
    ])
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }

    let resolveHistoricalSubmit: () => void
    const historicalSubmit = new Promise<void>(resolve => { resolveHistoricalSubmit = resolve })
    const submitShortQuestionnaire = vi.fn(async (payload: { training_session_id: string }) => {
      if (payload.training_session_id === 'historical-session') {
        await historicalSubmit
      }
      return {
        id: 1,
        user: 1,
        ...payload,
        feeling_scale: 4,
        felt_arousal_scale: 5,
        created_at: '2026-07-19T10:00:00Z',
        updated_at: '2026-07-19T10:00:00Z'
      }
    })
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true, ensureSession: vi.fn().mockResolvedValue(undefined), submitShortQuestionnaire },
      {},
      { pendingShortQuestionnaires }
    )

    const retryPromise = sync.retryPendingShortQuestionnaires()
    await vi.waitFor(() => expect(submitShortQuestionnaire).toHaveBeenCalledWith({
      training_session_id: 'historical-session',
      feeling_scale: 1,
      felt_arousal_scale: 2
    }))

    const currentResult = await sync.syncShortQuestionnaire({
      sessionId: 'current-session',
      feelingScale: 4,
      feltArousalScale: 5
    })

    expect(currentResult).toEqual({ synced: true })
    expect(submitShortQuestionnaire).toHaveBeenCalledWith({
      training_session_id: 'current-session',
      feeling_scale: 4,
      felt_arousal_scale: 5
    })

    resolveHistoricalSubmit!()
    await retryPromise
  })

  it('does not let an in-flight retry remove a newly saved response for the same session', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>([
      ['session-A', {
        sessionId: 'session-A',
        response: { feelingScale: 1, feltArousalScale: 1},
        queuedAt: '2026-07-18T10:00:00.000Z'
      }]
    ])
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }

    let resolveRetrySubmit: () => void
    const retrySubmitPromise = new Promise<void>(resolve => { resolveRetrySubmit = resolve })

    let callCount = 0
    const submitShortQuestionnaire = vi.fn(async (payload: { training_session_id: string }) => {
      callCount++
      if (callCount === 1) {
        await retrySubmitPromise // Block the retry's submit
        return { id: 1, user: 1, feeling_scale: 1, felt_arousal_scale: 1, ...payload, created_at: '2026-07-19T10:00:00Z', updated_at: '2026-07-19T10:00:00Z' }
      }
      // Second call (from syncShortQuestionnaire) fails so the new response stays durable
      throw new Error('network error')
    })

    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true, ensureSession: vi.fn().mockResolvedValue(undefined), submitShortQuestionnaire },
      {},
      { pendingShortQuestionnaires }
    )

    // Start retry — it lists, sees session-A, and blocks on submitShortQuestionnaire
    const retryPromise = sync.retryPendingShortQuestionnaires()
    await vi.waitFor(() => expect(submitShortQuestionnaire).toHaveBeenCalledTimes(1))

    // While retry is in-flight, submit a new response for the same session.
    // This is serialized behind the retry and will only run after the retry completes.
    const syncPromise = sync.syncShortQuestionnaire({
      sessionId: 'session-A',
      feelingScale: 5,
      feltArousalScale: 5
    })

    // Release the retry's blocked submit — retry succeeds and removes session-A
    resolveRetrySubmit!()

    await retryPromise
    const syncResult = await syncPromise

    // The sync's network failed, so it returns network-error (durable save succeeded)
    expect(syncResult).toEqual({ synced: false, reason: 'network-error' })

    // The new response must still be in the store — the retry's remove(session-A)
    // ran BEFORE the sync's save(session-A) due to serialization.
    expect(entries.get('session-A')?.response).toEqual({ feelingScale: 5, feltArousalScale: 5})
  })

  it('returns network-error instead of throwing when the durable save succeeds but the network submit fails', async () => {
    const entries = new Map<string, PendingShortQuestionnaireSubmission>()
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PendingShortQuestionnaireSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }
    const submitShortQuestionnaire = vi.fn().mockRejectedValue(new Error('offline'))
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      { isEnabled: () => true, ensureSession: vi.fn().mockResolvedValue(undefined), submitShortQuestionnaire },
      {},
      { pendingShortQuestionnaires }
    )

    const result = await sync.syncShortQuestionnaire({
      sessionId: 'session-net-fail',
      feelingScale: 3,
      feltArousalScale: 4
    })

    expect(result).toEqual({ synced: false, reason: 'network-error' })
    // The durable save succeeded, so the response stays pending for a later retry
    expect(entries.get('session-net-fail')?.response).toEqual({
      feelingScale: 3,
      feltArousalScale: 4
    })
  })
})
