import { describe, expect, it } from 'vitest'
import type { StudentProfile } from '../types/student'

function createProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    studentId: '20260001',
    name: 'Lin',
    gender: '女',
    age: 12,
    major: 'Sports Science',
    grade: '一年级',
    heightCm: 160,
    weightKg: 45,
    restingHeartRate: 72,
    completed: true,
    ...overrides
  }
}

describe('student backend API payload mapping', () => {
  it('maps the registration form to the backend profile update payload', async () => {
    const { mapStudentProfileToUserUpdatePayload } = await import('../uni-app/api/studentBackend')

    const payload = mapStudentProfileToUserUpdatePayload(createProfile())

    expect(payload).toEqual({
      name: 'Lin',
      gender: 2,
      student_id: '20260001',
      major: 'Sports Science',
      height: 160,
      weight: 45,
      age: 12,
      grade: '一年级',
      resting_heart_rate: 72
    })
  })

  it('builds a registration survey record for research profile fields', async () => {
    const { buildRegistrationSurveyRecordPayload } = await import('../uni-app/api/studentBackend')

    const payload = buildRegistrationSurveyRecordPayload(createProfile())
    const analysis = JSON.parse(payload.analysis)

    expect(payload.survey_type).toBe(1)
    expect(payload.score).toBeUndefined()
    expect(analysis).toEqual(
      expect.objectContaining({
        source: 'registration',
        grade: '一年级',
        age: 12,
        restingHeartRate: 72
      })
    )
  })

  it('builds a long questionnaire survey record payload', async () => {
    const { buildLongQuestionnaireSurveyRecordPayload } = await import('../uni-app/api/studentBackend')

    const payload = buildLongQuestionnaireSurveyRecordPayload({
      checkpoint: 'baseline',
      responses: {
        focus: 4,
        confidence: 5
      },
      score: 9,
      percentage: 90,
      submittedAt: '2026-04-09T15:30:00.000Z'
    })

    expect(payload.survey_type).toBe(2)
    expect(payload.score).toBe(9)
    expect(JSON.parse(payload.analysis)).toEqual({
      source: 'long-questionnaire',
      checkpoint: 'baseline',
      percentage: 90,
      submittedAt: '2026-04-09T15:30:00.000Z',
      responses: {
        focus: 4,
        confidence: 5
      }
    })
  })

  it('maps a backend psychology scale to a questionnaire form model', async () => {
    const { mapBackendScaleToQuestionnaire } = await import('../uni-app/api/psychologyModels')

    expect(
      mapBackendScaleToQuestionnaire({
        id: 1,
        title: '运动心理健康量表（第1次）',
        description: '评估运动对心理健康的影响',
        order: 1,
        created_at: '2026-04-11T09:00:00Z',
        questions: [
          {
            id: 11,
            question_text: '您最近一周的运动频率如何？',
            question_type: 'SINGLE',
            order: 1,
            options: [
              { id: 101, option_text: '每天都运动', score: 5, order: 1 },
              { id: 102, option_text: '3-5天', score: 4, order: 2 }
            ]
          }
        ]
      })
    ).toEqual({
      scaleId: 1,
      title: '运动心理健康量表（第1次）',
      description: '评估运动对心理健康的影响',
      checkpoint: 'baseline',
      questions: [
        {
          id: 11,
          prompt: '您最近一周的运动频率如何？',
          options: [
            { id: 101, label: '每天都运动', score: 5 },
            { id: 102, label: '3-5天', score: 4 }
          ]
        }
      ]
    })
  })

  it('builds a formal psychology submit payload from selected backend options', async () => {
    const { buildPsychologyScaleSubmitPayload } = await import('../uni-app/api/psychologyModels')

    expect(
      buildPsychologyScaleSubmitPayload(1, {
        11: 101,
        12: 104
      })
    ).toEqual({
      scale_id: 1,
      answers: [
        {
          question_id: 11,
          selected_options: [101]
        },
        {
          question_id: 12,
          selected_options: [104]
        }
      ]
    })
  })

  it('maps a visual training modality to the backend exercise type', async () => {
    const { resolveBackendExerciseType } = await import('../uni-app/api/studentBackend')

    expect(resolveBackendExerciseType('wushu')).toBe('MARTIAL_ARTS')
    expect(resolveBackendExerciseType('hiit')).toBe('HIIT')
  })

  it('builds a stairs record payload from the local sensor summary', async () => {
    const { buildStairsRecordPayload } = await import('../uni-app/api/studentBackend')

    expect(
      buildStairsRecordPayload({
        sessionId: 'stairs-summary-session',
        durationSeconds: 28,
        completedIntervals: 1,
        qualityScore: 83,
        summary: {
          summaryText: '传感器采集很稳定。',
          estimatedStepCount: 64,
          activeClimbSeconds: 24.8,
          cadenceSpmAvg: 128,
          cadenceSpmPeak: 144,
          cadenceStability: 0.82,
          estimatedVerticalSpeedMps: 0.44,
          estimatedFloorsPerMin: 3.1,
          pauseCount: 1,
          confidence: 0.87,
          calories: 8.6
        }
      })
    ).toEqual({
      duration: 28,
      training_session_id: 'stairs-summary-session',
      speed_data: {
        completedIntervals: 1,
        activeClimbSeconds: 24.8,
        cadenceSpmAvg: 128,
        cadenceSpmPeak: 144,
        cadenceStability: 0.82,
        estimatedVerticalSpeedMps: 0.44,
        estimatedFloorsPerMin: 3.1,
        pauseCount: 1,
        confidence: 0.87
      },
      acceleration_data: {
        qualityScore: 83,
        summaryText: '传感器采集很稳定。',
        confidence: 0.87,
        cadenceStability: 0.82,
        pauseCount: 1
      },
      steps_count: 64,
      calories: 8.6
    })
  })

  it('carries the stable client session id into a stairs completion request', async () => {
    const { buildStairsRecordPayload } = await import('../uni-app/api/studentBackend')

    expect(
      buildStairsRecordPayload({
        sessionId: 'stairs-session-123',
        durationSeconds: 30,
        completedIntervals: 1,
        qualityScore: 83,
        summary: '完成楼梯训练。'
      })
    ).toEqual(expect.objectContaining({
      training_session_id: 'stairs-session-123'
    }))
  })

  it('keeps supporting string-based stair summaries as a backward-compatible payload fallback', async () => {
    const { buildStairsRecordPayload } = await import('../uni-app/api/studentBackend')

    expect(
      buildStairsRecordPayload({
        sessionId: 'stairs-fallback-session',
        durationSeconds: 28,
        completedIntervals: 1,
        qualityScore: 83,
        summary: '传感器采集很稳定。'
      })
    ).toEqual({
      duration: 28,
      training_session_id: 'stairs-fallback-session',
      speed_data: {
        completedIntervals: 1
      },
      acceleration_data: {
        qualityScore: 83,
        summaryText: '传感器采集很稳定。'
      },
      steps_count: null,
      calories: null
    })
  })

  it('builds a compact visual pose analysis payload from filtered angle frames', async () => {
    const { buildVisualPoseAnalysisPayload } = await import('../uni-app/api/studentBackend')

    expect(
      buildVisualPoseAnalysisPayload([
        {
          tsMs: 100,
          angles: {
            leftKnee: Math.PI / 2
          },
          bodyRotationRad: 0.2
        },
        null,
        {
          tsMs: 200,
          angles: {
            rightShoulder: Math.PI / 3
          }
        }
      ])
    ).toEqual({
      schema_version: '0.1',
      sequence_id: 'student_100',
      source: 'student',
      fps: 10,
      angle_unit: 'radian',
      angle_names: [
        'left_elbow',
        'right_elbow',
        'left_shoulder',
        'right_shoulder',
        'left_hip',
        'right_hip',
        'left_knee',
        'right_knee',
        'torso_rotation'
      ],
      frames: [
        {
          frame_index: 0,
          time: 0,
          values: [null, null, null, null, null, null, Math.PI / 2, null, 0.2]
        },
        {
          frame_index: 1,
          time: 0.1,
          values: [null, null, null, Math.PI / 3, null, null, null, null, null]
        }
      ]
    })
  })
})
