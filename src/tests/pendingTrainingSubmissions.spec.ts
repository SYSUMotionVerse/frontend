import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPendingTrainingSubmissionStore } from '../uni-app/platform/pendingTrainingSubmissions'

describe('pending training submissions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('survives a new store instance with the exact session payload', () => {
    let stored: unknown = []
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => stored),
      setStorageSync: vi.fn((_key: string, value: unknown) => {
        stored = value
      })
    })
    const firstStore = createPendingTrainingSubmissionStore()
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

    const reloadedStore = createPendingTrainingSubmissionStore()

    expect(reloadedStore.list()).toEqual([
      expect.objectContaining({
        sessionId: 'durable-session',
        durationSeconds: 30,
        summary: expect.objectContaining({ estimatedStepCount: 80 })
      })
    ])
  })
})
