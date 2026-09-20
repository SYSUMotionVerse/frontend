import { describe, expect, it, vi } from 'vitest'
import { createQuestionnaireDraftStorage } from '../uni-app/platform/questionnaireDraftStorage'

function createPlatform() {
  const values = new Map<string, unknown>()
  return {
    values,
    getStorageSync: (key: string) => values.get(key),
    setStorageSync: (key: string, value: unknown) => values.set(key, value),
    removeStorageSync: (key: string) => values.delete(key)
  }
}

describe('questionnaireDraftStorage', () => {
  it('isolates daily drafts by Shanghai date and keeps yesterday separate when clearing today', () => {
    vi.useFakeTimers()
    try {
      const platform = createPlatform()
      const storage = createQuestionnaireDraftStorage(platform)
      vi.setSystemTime(new Date('2026-09-20T15:59:00Z'))
      storage.save({ studentId: 'daily', checkpoint: 'daily', scaleId: 12,
        answers: { 1: 11 }, currentQuestionIndex: 0, updatedAt: new Date().toISOString() })
      expect(storage.load('daily', 'daily', 12)?.answers).toEqual({ 1: 11 })
      vi.setSystemTime(new Date('2026-09-20T16:01:00Z'))
      expect(storage.load('daily', 'daily', 12)).toBeNull()
      storage.save({ studentId: 'daily', checkpoint: 'daily', scaleId: 12,
        answers: { 1: 22 }, currentQuestionIndex: 0, updatedAt: new Date().toISOString() })
      expect(storage.load('daily', 'daily', 12)?.answers).toEqual({ 1: 22 })
      storage.clear('daily', 'daily', 12)
      expect(platform.values.size).toBe(1)
      vi.setSystemTime(new Date('2026-09-20T15:59:00Z'))
      expect(storage.load('daily', 'daily', 12)?.answers).toEqual({ 1: 11 })
    } finally { vi.useRealTimers() }
  })

  it('saves and restores answers with the active question', () => {
    const platform = createPlatform()
    const storage = createQuestionnaireDraftStorage(platform)

    storage.save({
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 12,
      answers: { 1: 11, 2: 21 },
      currentQuestionIndex: 1,
      updatedAt: '2026-07-30T05:00:00.000Z'
    })

    expect(storage.load('20260001', 'baseline', 12)).toEqual({
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 12,
      answers: { 1: 11, 2: 21 },
      currentQuestionIndex: 1,
      updatedAt: '2026-07-30T05:00:00.000Z'
    })
  })

  it('keeps drafts isolated by checkpoint and scale and clears only confirmed work', () => {
    const platform = createPlatform()
    const storage = createQuestionnaireDraftStorage(platform)

    storage.save({
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 12,
      answers: { 1: 11 },
      currentQuestionIndex: 0,
      updatedAt: '2026-07-30T05:00:00.000Z'
    })
    storage.save({
      studentId: '20260001',
      checkpoint: 'week4',
      scaleId: 18,
      answers: { 5: 51 },
      currentQuestionIndex: 0,
      updatedAt: '2026-07-30T05:01:00.000Z'
    })

    storage.clear('20260001', 'baseline', 12)

    expect(storage.load('20260001', 'baseline', 12)).toBeNull()
    expect(storage.load('20260001', 'week4', 18)?.answers).toEqual({ 5: 51 })
  })

  it('isolates drafts between student accounts', () => {
    const platform = createPlatform()
    const storage = createQuestionnaireDraftStorage(platform)

    storage.save({
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 12,
      answers: { 1: 11 },
      currentQuestionIndex: 0,
      updatedAt: '2026-07-30T05:00:00.000Z'
    })

    expect(storage.load('20260002', 'baseline', 12)).toBeNull()
    expect(storage.load('20260001', 'baseline', 12)?.answers).toEqual({ 1: 11 })
  })

  it('ignores malformed storage instead of exposing invalid answers', () => {
    const platform = createPlatform()
    const storage = createQuestionnaireDraftStorage(platform)

    platform.setStorageSync('sport-snack:questionnaire-draft:v2:20260001:baseline:12', {
      version: 2,
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 12,
      answers: { 1: 0 },
      currentQuestionIndex: 0,
      updatedAt: 'invalid'
    })

    expect(storage.load('20260001', 'baseline', 12)).toBeNull()
  })

  it('keeps unanswered placeholders out of a valid saved draft', () => {
    const platform = createPlatform()
    const storage = createQuestionnaireDraftStorage(platform)

    platform.setStorageSync('sport-snack:questionnaire-draft:v2:20260001:baseline:12', {
      version: 2,
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 12,
      answers: { 1: 11, 2: 0 },
      currentQuestionIndex: 1,
      updatedAt: '2026-07-30T05:00:00.000Z'
    })

    expect(storage.load('20260001', 'baseline', 12)?.answers).toEqual({ 1: 11 })
  })

  it('keeps structured text answers used by GPAQ duration fields', () => {
    const platform = createPlatform()
    const storage = createQuestionnaireDraftStorage(platform)
    storage.save({
      studentId: '20260001',
      checkpoint: 'baseline',
      scaleId: 20,
      answers: { 3: '{"hours":0,"minutes":45}' },
      currentQuestionIndex: 2,
      updatedAt: '2026-07-30T06:00:00.000Z'
    })

    expect(storage.load('20260001', 'baseline', 20)?.answers[3])
      .toBe('{"hours":0,"minutes":45}')
  })
})
