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
      title: '马步冲拳',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/mabu.mp4',
      duration: 30
    },
    expected_duration: 30,
    countdown_duration: 3,
    rest_duration: 5,
    standard_data_url: 'https://cdn.example.com/mabu.json',
    order: 1
  },
  {
    id: 12,
    video_id: 102,
    video: {
      id: 102,
      title: '弓步冲拳',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/gongbu.mp4',
      duration: 30
    },
    expected_duration: 30,
    countdown_duration: 3,
    rest_duration: 5,
    standard_data_url: 'https://cdn.example.com/gongbu.json',
    order: 2
  }
]

describe('visual workout timeline', () => {
  it('builds rest, one full demonstration, and start countdown before the next action', () => {
    const timeline = buildVisualWorkoutTimeline(items)

    expect(timeline.map(phase => [phase.kind, phase.title])).toEqual([
      ['preview', '准备：马步冲拳'],
      ['active', '马步冲拳'],
      ['rest', '休息，准备：弓步冲拳'],
      ['demonstration', '动作示范：弓步冲拳'],
      ['countdown', '准备开始：弓步冲拳'],
      ['active', '弓步冲拳']
    ])
    expect(timeline.map(phase => [phase.startSeconds, phase.endSeconds])).toEqual([
      [0, 15],
      [15, 45],
      [45, 50],
      [50, 80],
      [80, 83],
      [83, 113]
    ])
    expect(timeline[1].countdownDuration).toBe(3)
    expect(timeline.at(-1)?.endSeconds).toBe(113)
  })

  it('switches the active phase exactly at its start and exposes the next phase', () => {
    const timeline = buildVisualWorkoutTimeline(items)

    const beforeBoundary = resolveVisualWorkoutState(timeline, 14.9)
    const atBoundary = resolveVisualWorkoutState(timeline, 15)

    expect(beforeBoundary.current.title).toBe('准备：马步冲拳')
    expect(beforeBoundary.next?.title).toBe('马步冲拳')
    expect(beforeBoundary.remainingSeconds).toBe(1)

    expect(atBoundary.current.title).toBe('马步冲拳')
    expect(atBoundary.actionNumber).toBe(1)
    expect(atBoundary.totalActions).toBe(2)
    expect(atBoundary.phaseProgressPercent).toBe(0)
    expect(atBoundary.remainingSeconds).toBe(30)
  })

  it('clamps progress at the beginning and end of the workout', () => {
    const timeline = buildVisualWorkoutTimeline(items)

    expect(resolveVisualWorkoutState(timeline, -10).sessionProgressPercent).toBe(0)

    const completed = resolveVisualWorkoutState(timeline, 1_000)
    expect(completed.current.title).toBe('弓步冲拳')
    expect(completed.next).toBeNull()
    expect(completed.remainingSeconds).toBe(0)
    expect(completed.phaseProgressPercent).toBe(100)
    expect(completed.sessionProgressPercent).toBe(100)
  })

  it('keeps the fixed initial preview and omits a zero-length rest', () => {
    const timeline = buildVisualWorkoutTimeline([
      { ...items[0], countdown_duration: 0, rest_duration: 0 }
    ])

    expect(timeline.map(phase => phase.kind)).toEqual(['preview', 'active'])
    expect(timeline[0].endSeconds).toBe(15)
    expect(timeline[1].countdownDuration).toBe(0)
    expect(() => resolveVisualWorkoutState([], 0)).toThrow(
      'Visual workout timeline requires at least one phase.'
    )
  })
})
