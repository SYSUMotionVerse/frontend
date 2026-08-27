import { describe, expect, it } from 'vitest'
import type { ExerciseArrangementItem } from '../uni-app/api/studentBackendTypes'
import {
  resolveTrainingCountdownAudioUrls,
  resolveTrainingCountdownTtsCues,
  resolveEmbeddedPretrainingCountdownDuration,
  resolveTrainingPhaseCompletionAudioUrls,
  resolveTrainingPhaseDelayedTtsCues,
  resolveTrainingPhaseStartAudioUrls,
  resolveTrainingPhaseTtsCues,
  resolveArrangementTtsAudioUrls
} from '../features/training/trainingTtsConfig'

const item: ExerciseArrangementItem = {
  id: 1,
  video_id: 10,
  video: {
    id: 10,
    title: '高抬腿',
    exercise_type: 'HIIT',
    video_file: 'https://cdn.example.com/high-knees.mp4',
    duration: 30
  },
  pretraining_mode: 'FULL',
  pretraining_countdown_duration: 0,
  expected_duration: 30,
  formal_countdown_duration: 3,
  order: 1,
  training_tts_cues: [
    {
      id: 1,
      phase: 'PRETRAINING',
      timing: 'START',
      offset_seconds: 0,
      text: '先看完整示范。',
      audio_url: 'https://cdn.example.com/pre-start.mp3',
      order: 0
    },
    {
      id: 2,
      phase: 'PRETRAINING',
      timing: 'AFTER_OFFSET',
      offset_seconds: 5,
      text: '膝盖向上。',
      audio_url: 'https://cdn.example.com/pre-5.mp3',
      order: 1
    },
    {
      id: 3,
      phase: 'FORMAL',
      timing: 'START',
      offset_seconds: 0,
      text: '正式开始。',
      audio_url: 'https://cdn.example.com/formal-start.mp3',
      order: 0
    },
    {
      id: 4,
      phase: 'FORMAL',
      timing: 'COMPLETE',
      offset_seconds: 0,
      text: '本组完成。',
      audio_url: 'https://cdn.example.com/formal-complete.mp3',
      order: 1
    },
  ]
}

describe('trainingTtsConfig', () => {
  it('keeps action guidance in the pretraining demonstration timeline', () => {
    const cues = resolveTrainingPhaseTtsCues(item, 'PRETRAINING', {
      phaseDurationSeconds: 30
    })

    expect(resolveTrainingPhaseStartAudioUrls(cues)).toEqual([
      'https://cdn.example.com/pre-start.mp3'
    ])
    expect(resolveTrainingPhaseDelayedTtsCues(cues)).toEqual([
      expect.objectContaining({ time: 5, audio_url: 'https://cdn.example.com/pre-5.mp3' })
    ])
  })

  it('keeps completion prompts distinct from timed video guidance', () => {
    expect(resolveTrainingPhaseTtsCues(item, 'FORMAL', {
      phaseDurationSeconds: 30
    })).toEqual([
      expect.objectContaining({ audio_url: 'https://cdn.example.com/formal-start.mp3' })
    ])
    expect(resolveTrainingPhaseCompletionAudioUrls(item, 'FORMAL')).toEqual([
      'https://cdn.example.com/formal-complete.mp3'
    ])
  })

  it('preloads only cues from training modules that will actually run', () => {
    const disabledPretraining = {
      ...item,
      pretraining_mode: 'NONE' as const,
      training_tts_cues: [
        {
          id: 10,
          phase: 'PRETRAINING' as const,
          timing: 'START' as const,
          offset_seconds: 0,
          text: '这条预训练语音不会有对应模块。',
          audio_url: 'https://cdn.example.com/unreachable-pretraining.mp3',
          order: 0
        },
        {
          id: 11,
          phase: 'FORMAL' as const,
          timing: 'START' as const,
          offset_seconds: 0,
          text: '这条正式训练语音会播放。',
          audio_url: 'https://cdn.example.com/formal-start.mp3',
          order: 0
        }
      ]
    }

    expect(resolveArrangementTtsAudioUrls([disabledPretraining])).toEqual([
      'https://cdn.example.com/formal-start.mp3'
    ])
  })

  it('uses only backend-configured countdown audio and never action-standard fallback audio', () => {
    const countdownCues = [
      { seconds_remaining: 1, text: '一', audio_url: 'https://cdn.example.com/1.mp3' },
      { seconds_remaining: 3, text: '三', audio_url: 'https://cdn.example.com/3.mp3' },
      { seconds_remaining: 2, text: '二', audio_url: 'https://cdn.example.com/2.mp3' }
    ] as const
    expect(resolveTrainingCountdownAudioUrls(countdownCues, 3)).toEqual([
      'https://cdn.example.com/3.mp3',
      'https://cdn.example.com/2.mp3',
      'https://cdn.example.com/1.mp3'
    ])
    expect(resolveTrainingCountdownAudioUrls([], 3)).toEqual([])

    expect(resolveTrainingCountdownTtsCues(countdownCues, 5)).toEqual([
      expect.objectContaining({ time: 2, audio_url: 'https://cdn.example.com/3.mp3' }),
      expect.objectContaining({ time: 3, audio_url: 'https://cdn.example.com/2.mp3' }),
      expect.objectContaining({ time: 4, audio_url: 'https://cdn.example.com/1.mp3' })
    ])
  })

  it('detects a 3/2/1/Go hand-off embedded at the end of pretraining', () => {
    const embeddedItem = {
      ...item,
      pretraining_duration: 20,
      training_tts_cues: [{
        id: 20,
        phase: 'PRETRAINING' as const,
        timing: 'AFTER_OFFSET' as const,
        offset_seconds: 17,
        text: '正式训练，3，2，1，go！',
        audio_url: 'https://cdn.example.com/embedded-countdown.mp3',
        order: 2
      }]
    }

    expect(resolveEmbeddedPretrainingCountdownDuration(embeddedItem, 20)).toBe(3)
    expect(resolveEmbeddedPretrainingCountdownDuration(item, 20)).toBe(0)
  })

  it('recognizes full-width countdown digits in embedded hand-off cues', () => {
    const embeddedItem = {
      ...item,
      training_tts_cues: [{
        id: 21,
        phase: 'PRETRAINING' as const,
        timing: 'AFTER_OFFSET' as const,
        offset_seconds: 17,
        text: '３，２，１，go！',
        audio_url: 'https://cdn.example.com/embedded-countdown-full-width.mp3',
        order: 0
      }]
    }

    expect(resolveEmbeddedPretrainingCountdownDuration(embeddedItem, 20)).toBe(3)
  })
})
