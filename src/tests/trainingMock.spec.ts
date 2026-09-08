import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildMockExerciseArrangements,
  buildMockTrainingCompletion,
  buildMockTrainingSession,
  buildMockTrainingTrend,
  isTrainingMockEnabled
} from '../features/training/trainingMock'

describe('training mock fixtures', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('enables the shortcut only for an explicit true environment variable', () => {
    vi.stubEnv('VITE_TRAINING_MOCK_ENABLED', 'true')
    expect(isTrainingMockEnabled()).toBe(true)

    vi.stubEnv('VITE_TRAINING_MOCK_ENABLED', 'false')
    expect(isTrainingMockEnabled()).toBe(false)

    vi.stubEnv('VITE_TRAINING_MOCK_ENABLED', '1')
    expect(isTrainingMockEnabled()).toBe(false)
  })

  it('provides local arrangements when the backend is unavailable', () => {
    const hiit = buildMockExerciseArrangements('hiit')
    const wushu = buildMockExerciseArrangements('wushu')

    expect(hiit).toHaveLength(2)
    expect(hiit[0]).toMatchObject({ exercise_type: 'HIIT', item_count: 3 })
    expect(wushu).toHaveLength(2)
    expect(wushu[0]).toMatchObject({ exercise_type: 'MARTIAL_ARTS', item_count: 3 })
  })

  it('builds stable scored feedback for both visual training modalities', () => {
    const hiit = buildMockTrainingCompletion({
      modality: 'hiit',
      arrangementId: 8,
      sessionId: 'mock-hiit',
      completedAt: '2026-09-08T02:00:00.000Z'
    })
    const wushu = buildMockTrainingSession({
      modality: 'wushu',
      arrangementId: 4,
      sessionId: 'mock-wushu',
      completedAt: '2026-09-08T02:00:00.000Z'
    })

    expect(hiit).toMatchObject({
      sessionId: 'mock-hiit',
      modality: 'hiit',
      qualityScore: 86,
      capturedBy: 'camera',
      countsAsCompletion: true
    })
    expect(hiit.scoreDetails?.actionResults).toHaveLength(3)
    expect(wushu).toMatchObject({
      id: 'mock-wushu',
      modality: 'wushu',
      date: '2026-09-08',
      analysis: { qualityScore: 91 }
    })
    expect(wushu.analysis.scoreDetails?.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'left_hip', label: '左髋' }),
      expect.objectContaining({ key: 'right_hip', label: '右髋' }),
      expect.objectContaining({ key: 'left_knee', label: '左膝' }),
      expect.objectContaining({ key: 'right_knee', label: '右膝' })
    ]))
    expect(buildMockTrainingTrend(wushu.date, 91)).toHaveLength(6)
    expect(buildMockTrainingTrend(wushu.date, 91).at(-1)?.score).toBe(91)
  })
})
