import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPendingTrainingSubmissionStore } from '../uni-app/platform/pendingTrainingSubmissions'

describe('pending training submissions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('survives a new store instance with the exact session payload', () => {
    const now = new Date('2026-07-16T10:00:00.000Z')
    let stored: unknown = []
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      })
    })
    const firstStore = createPendingTrainingSubmissionStore({ now: () => now })
    firstStore.save({
      kind: 'stairs',
      sessionId: 'durable-session',
      queuedAt: '2026-07-16T10:00:00.000Z',
      durationSeconds: 30,
      completedIntervals: 1,
      qualityScore: 82,
      summary: {
        estimatedStepCount: 80
      }
    })

    const reloadedStore = createPendingTrainingSubmissionStore({ now: () => now })

    expect(reloadedStore.list()).toEqual([
      expect.objectContaining({
        sessionId: 'durable-session',
        durationSeconds: 30,
        summary: expect.objectContaining({ estimatedStepCount: 80 })
      })
    ])
  })

  it('retains at least 90 entries to cover 30 days at 3 sessions per day', () => {
    const now = new Date('2026-07-31T00:00:00.000Z')
    let stored: unknown = []
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })
    const baseDate = new Date('2026-07-01T00:00:00.000Z')

    // Simulate 30 days × 3 sessions = 90 entries
    for (let day = 0; day < 30; day++) {
      for (let session = 0; session < 3; session++) {
        const d = new Date(baseDate)
        d.setDate(d.getDate() + day)
        d.setHours(d.getHours() + session)
        store.save({
          kind: 'visual',
          sessionId: `session-day${day}-s${session}`,
          modality: 'hiit',
          queuedAt: d.toISOString(),
          durationSeconds: 60 + session * 10
        })
      }
    }

    const items = store.list()
    expect(items).toHaveLength(90)
    expect(items[0].sessionId).toBe('session-day0-s0')
    expect(items[89].sessionId).toBe('session-day29-s2')
  })

  it('drops malformed and legacy entries during read', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid visual entry
      {
        kind: 'visual',
        sessionId: 'valid',
        modality: 'wushu',
        durationSeconds: 45,
        score: 82.5,
        comment: '动作基本到位。',
        queuedAt: '2026-07-18T10:00:00.000Z'
      },
      // malformed: missing sessionId
      { kind: 'visual', modality: 'wushu', durationSeconds: 30, queuedAt: '2026-07-18T10:00:00.000Z' },
      // malformed: invalid queuedAt
      { kind: 'stairs', sessionId: 'bad-date', durationSeconds: 30, completedIntervals: 1, qualityScore: 80, summary: {}, queuedAt: 'not-a-date' },
      // malformed: invalid kind
      { kind: 'unknown', sessionId: 'bad-kind', durationSeconds: 30, queuedAt: '2026-07-18T10:00:00.000Z' },
      // malformed: non-finite durationSeconds
      { kind: 'visual', sessionId: 'bad-dur', modality: 'hiit', durationSeconds: Infinity, queuedAt: '2026-07-18T10:00:00.000Z' },
      // malformed: score outside the accepted range
      { kind: 'visual', sessionId: 'bad-score', modality: 'hiit', durationSeconds: 30, score: 101, queuedAt: '2026-07-18T10:00:00.000Z' },
      // not an object
      'string',
      null,
      42
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    expect(written).toEqual(items)
  })

  it('expires entries older than the 30-day TTL', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      {
        kind: 'visual',
        sessionId: 'recent',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        kind: 'visual',
        sessionId: 'expired',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['recent'])
    expect(written).toEqual(items)
  })

  it('clears all entries via the clear API', () => {
    const now = new Date()
    let stored: unknown = []
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => { stored = value }),
      removeStorageSync: vi.fn((_key: string) => { stored = [] })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })
    store.save({
      kind: 'visual',
      sessionId: 'session-a',
      modality: 'hiit',
      durationSeconds: 30,
      queuedAt: now.toISOString()
    })
    expect(store.list()).toHaveLength(1)

    store.clear()

    expect(store.list()).toEqual([])
  })

  it('rejects entries with future-dated queuedAt beyond the clock-skew allowance', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid recent entry
      {
        kind: 'visual',
        sessionId: 'valid',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: '2026-07-18T11:55:00.000Z'
      },
      // future-dated: 10 minutes ahead (beyond 5 min skew)
      {
        kind: 'visual',
        sessionId: 'future-far',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: '2026-07-18T12:10:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const store = createPendingTrainingSubmissionStore({
      now: () => now,
      maxClockSkewMs: 5 * 60 * 1000
    })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    expect(written).toEqual(items)
  })

  it('keeps entries within the clock-skew allowance', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // entry 2 minutes in the future (within 5 min skew)
      {
        kind: 'visual',
        sessionId: 'near-future',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: '2026-07-18T12:02:00.000Z'
      }
    ]
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn()
    })
    const store = createPendingTrainingSubmissionStore({
      now: () => now,
      maxClockSkewMs: 5 * 60 * 1000
    })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['near-future'])
  })

  it('rejects entries with nonpositive durationSeconds', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid
      {
        kind: 'visual',
        sessionId: 'valid',
        modality: 'hiit',
        durationSeconds: 30,
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // zero duration
      {
        kind: 'visual',
        sessionId: 'zero-dur',
        modality: 'hiit',
        durationSeconds: 0,
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // negative duration
      {
        kind: 'visual',
        sessionId: 'neg-dur',
        modality: 'hiit',
        durationSeconds: -10,
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // negative duration on stairs
      {
        kind: 'stairs',
        sessionId: 'neg-dur-stairs',
        durationSeconds: -5,
        completedIntervals: 1,
        qualityScore: 80,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    expect(written).toEqual(items)
  })

  it('rejects entries with negative completedIntervals', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid stairs entry
      {
        kind: 'stairs',
        sessionId: 'valid',
        durationSeconds: 30,
        completedIntervals: 1,
        qualityScore: 80,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // negative completedIntervals
      {
        kind: 'stairs',
        sessionId: 'neg-intervals',
        durationSeconds: 30,
        completedIntervals: -1,
        qualityScore: 80,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // non-integer completedIntervals
      {
        kind: 'stairs',
        sessionId: 'frac-intervals',
        durationSeconds: 30,
        completedIntervals: 1.5,
        qualityScore: 80,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid'])
    expect(written).toEqual(items)
  })

  it('rejects entries with qualityScore outside the 0-100 domain', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const stored: unknown = [
      // valid stairs entry at boundary
      {
        kind: 'stairs',
        sessionId: 'valid-zero',
        durationSeconds: 30,
        completedIntervals: 0,
        qualityScore: 0,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // valid stairs entry at upper boundary
      {
        kind: 'stairs',
        sessionId: 'valid-hundred',
        durationSeconds: 30,
        completedIntervals: 1,
        qualityScore: 100,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // negative qualityScore
      {
        kind: 'stairs',
        sessionId: 'neg-quality',
        durationSeconds: 30,
        completedIntervals: 1,
        qualityScore: -1,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // qualityScore above 100
      {
        kind: 'stairs',
        sessionId: 'over-quality',
        durationSeconds: 30,
        completedIntervals: 1,
        qualityScore: 101,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      },
      // non-integer qualityScore
      {
        kind: 'stairs',
        sessionId: 'frac-quality',
        durationSeconds: 30,
        completedIntervals: 1,
        qualityScore: 80.5,
        summary: {},
        queuedAt: '2026-07-18T11:00:00.000Z'
      }
    ]
    let written: unknown = null
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        written = value
      })
    })
    const store = createPendingTrainingSubmissionStore({ now: () => now })

    const items = store.list()

    expect(items.map(item => item.sessionId)).toEqual(['valid-zero', 'valid-hundred'])
    expect(written).toEqual(items)
  })
})
