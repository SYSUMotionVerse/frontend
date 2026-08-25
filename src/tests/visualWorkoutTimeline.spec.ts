import { describe, expect, it } from 'vitest'
import {
  buildVisualWorkoutTimeline,
  resolveVisualWorkoutState
} from '../features/training/visualWorkoutTimeline'
import type { ExerciseArrangementItem } from '../uni-app/api/studentBackendTypes'

const items: ExerciseArrangementItem[] = [
  {
    id: 11,
    video_id: 101,
    video: {
      id: 101,
      title: '热身',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/warmup.mp4',
      duration: 15
    },
    pretraining_mode: 'FULL',
    pretraining_countdown_duration: 0,
    expected_duration: 15,
    formal_countdown_duration: 0,
    countdown_duration: 99,
    standard_data_url: 'https://cdn.example.com/warmup.json',
    order: 1
  },
  {
    id: 12,
    video_id: 102,
    video: {
      id: 102,
      title: '正式动作一',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/action-1.mp4',
      duration: 30
    },
    pretraining_mode: 'FULL',
    pretraining_countdown_duration: 2,
    expected_duration: 30,
    formal_countdown_duration: 3,
    countdown_duration: 99,
    standard_data_url: 'https://cdn.example.com/action-1.json',
    order: 2
  },
  {
    id: 13,
    video_id: 103,
    video: {
      id: 103,
      title: '正式动作二',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/action-2.mp4',
      duration: 30
    },
    pretraining_mode: 'NONE',
    pretraining_countdown_duration: 0,
    expected_duration: 30,
    formal_countdown_duration: 3,
    countdown_duration: 99,
    standard_data_url: 'https://cdn.example.com/action-2.json',
    order: 3
  }
]

describe('visual workout timeline', () => {
  it('maps the Django module configuration into a complete training sequence', () => {
    const timeline = buildVisualWorkoutTimeline(items)

    expect(timeline.map(phase => [phase.slot, phase.itemIndex])).toEqual([
      ['pretraining', 0],
      ['formal-training', 0],
      ['pretraining-countdown', 1],
      ['pretraining', 1],
      ['formal-countdown', 1],
      ['formal-training', 1],
      ['formal-countdown', 2],
      ['formal-training', 2]
    ])
    expect(timeline.map(phase => [phase.startSeconds, phase.endSeconds])).toEqual([
      [0, 15],
      [15, 30],
      [30, 32],
      [32, 62],
      [62, 65],
      [65, 95],
      [95, 98],
      [98, 128]
    ])
    expect(timeline.at(-1)?.endSeconds).toBe(128)
  })

  it('uses the full action video only when pretraining mode is FULL', () => {
    const timeline = buildVisualWorkoutTimeline(items)

    expect(timeline.filter(phase => phase.slot === 'pretraining')).toHaveLength(2)
    expect(timeline.find(phase => phase.itemIndex === 2 && phase.slot === 'pretraining'))
      .toBeUndefined()
  })

  it('supports a first-frame pretraining background with its own duration', () => {
    const timeline = buildVisualWorkoutTimeline([{
      ...items[1],
      pretraining_mode: 'FIRST_FRAME',
      pretraining_duration: 7,
      pretraining_countdown_duration: 2,
      formal_countdown_duration: 3
    }])
    const pretraining = timeline.find(phase => phase.slot === 'pretraining')

    expect(pretraining).toMatchObject({
      kind: 'demonstration',
      startSeconds: 2,
      endSeconds: 9,
      coachCue: '保持动作首帧，随后进入正式训练倒计时'
    })
    expect(timeline.at(-1)?.endSeconds).toBe(42)
  })

  it('skips the pretraining countdown together with a disabled pretraining module', () => {
    const timeline = buildVisualWorkoutTimeline([
      {
        ...items[2],
        pretraining_countdown_duration: 3,
        formal_countdown_duration: 3
      }
    ])

    expect(timeline.map(phase => phase.slot)).toEqual([
      'formal-countdown',
      'formal-training'
    ])
    expect(timeline.at(-1)?.endSeconds).toBe(33)
  })

  it('never uses a countdown value, including the legacy field, as formal-training duration', () => {
    const timeline = buildVisualWorkoutTimeline([items[1]])
    const formalTraining = timeline.find(phase => phase.slot === 'formal-training')

    expect(formalTraining).toBeDefined()
    expect(formalTraining!.endSeconds - formalTraining!.startSeconds).toBe(30)
    expect(timeline.find(phase => phase.slot === 'formal-countdown')?.endSeconds).toBe(35)
  })

  it('does not insert a rest phase between actions', () => {
    const timeline = buildVisualWorkoutTimeline([
      items[0],
      {
        ...items[2],
        id: 14,
        video_id: 104,
        pretraining_mode: 'NONE',
        formal_countdown_duration: 0,
        order: 2
      }
    ])

    expect(timeline.map(phase => phase.slot)).toEqual([
      'pretraining',
      'formal-training',
      'formal-training'
    ])
    expect(timeline.at(-1)?.endSeconds).toBe(60)
  })

  it('switches precisely between module slots and clamps progress', () => {
    const timeline = buildVisualWorkoutTimeline(items)
    const beforeBoundary = resolveVisualWorkoutState(timeline, 29.9)
    const atBoundary = resolveVisualWorkoutState(timeline, 30)

    expect(beforeBoundary.current.slot).toBe('formal-training')
    expect(beforeBoundary.next?.slot).toBe('pretraining-countdown')
    expect(beforeBoundary.remainingSeconds).toBe(1)
    expect(atBoundary.current.slot).toBe('pretraining-countdown')
    expect(atBoundary.phaseProgressPercent).toBe(0)
    expect(resolveVisualWorkoutState(timeline, -10).sessionProgressPercent).toBe(0)
    expect(resolveVisualWorkoutState(timeline, 1_000).next).toBeNull()
    expect(resolveVisualWorkoutState(timeline, 1_000).sessionProgressPercent).toBe(100)
  })

  it('omits zero-length optional modules and rejects an empty workout', () => {
    const timeline = buildVisualWorkoutTimeline([
      {
        ...items[0],
        pretraining_mode: 'NONE',
        pretraining_countdown_duration: 0,
        formal_countdown_duration: 0
      }
    ])

    expect(timeline.map(phase => phase.slot)).toEqual(['formal-training'])
    expect(() => resolveVisualWorkoutState([], 0)).toThrow(
      'Visual workout timeline requires at least one phase.'
    )
  })
})
