import { describe, expect, it } from 'vitest'
import type { ExerciseArrangementItem } from '../uni-app/api/studentBackendTypes'
import {
  resolveTrainingCountdownAudioUrls,
  resolveTrainingCountdownTtsCues,
  resolveTrainingRestCountdownTtsCues,
  resolveTrainingPhaseCompletionAudioUrls,
  resolveTrainingPhaseDelayedTtsCues,
  resolveTrainingPhaseStartAudioUrls,
  resolveTrainingPhaseTtsCues
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
  rest_duration: 20,
  rest_countdown_duration: 3,
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
    {
      id: 5,
      phase: 'REST',
      timing: 'BEFORE_COUNTDOWN',
      offset_seconds: 0,
      text: '准备下一动作，go！',
      audio_url: 'https://cdn.example.com/rest-go.mp3',
      order: 0
    }
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

  it('places the next-action go cue inside rest at the configured countdown boundary', () => {
    const cues = resolveTrainingPhaseTtsCues(item, 'REST', {
      phaseDurationSeconds: 20,
      countdownDurationSeconds: 3
    })

    expect(cues).toEqual([
      expect.objectContaining({ time: 17, audio_url: 'https://cdn.example.com/rest-go.mp3' })
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
    expect(resolveTrainingRestCountdownTtsCues(countdownCues, 20, 5)).toEqual([
      expect.objectContaining({ time: 17, audio_url: 'https://cdn.example.com/3.mp3' }),
      expect.objectContaining({ time: 18, audio_url: 'https://cdn.example.com/2.mp3' }),
      expect.objectContaining({ time: 19, audio_url: 'https://cdn.example.com/1.mp3' })
    ])
  })
})
