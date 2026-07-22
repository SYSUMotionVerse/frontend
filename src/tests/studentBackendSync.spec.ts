import { describe, expect, it, vi } from 'vitest'
import type { StudentProfile } from '../types/student'
import type { PendingTrainingSubmission } from '../uni-app/platform/pendingTrainingSubmissions'

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

describe('student backend sync orchestration', () => {
  function createPendingSubmissionStore() {
    const entries = new Map<string, PendingTrainingSubmission>()
    return {
      entries,
      store: {
        list: vi.fn(() => Array.from(entries.values())),
        save: vi.fn((entry: PendingTrainingSubmission) => {
          entries.set(entry.sessionId, entry)
        }),
        remove: vi.fn((sessionId: string) => {
          entries.delete(sessionId)
        }),
        clear: vi.fn(() => entries.clear())
      }
    }
  }

  it('syncs registration through login, profile update, and a survey record', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const updateProfile = vi.fn().mockResolvedValue(undefined)
    const createSurveyRecord = vi.fn().mockResolvedValue(undefined)

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      updateProfile,
      createSurveyRecord
    })

    await sync.syncRegistration(createProfile())

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lin',
        student_id: '20260001'
      })
    )
    expect(createSurveyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        survey_type: 1,
        analysis: expect.stringContaining('"source":"registration"')
      })
    )
  })

  it('rejects registration when required metadata cannot be persisted', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const updateProfile = vi.fn().mockResolvedValue(undefined)
    const createSurveyRecord = vi.fn().mockRejectedValue(new Error('Request failed with 400'))

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      updateProfile,
      createSurveyRecord
    })

    await expect(sync.syncRegistration(createProfile())).rejects.toThrow('Request failed with 400')

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(updateProfile).toHaveBeenCalledTimes(1)
    expect(createSurveyRecord).toHaveBeenCalledTimes(1)
  })

  it('syncs a long questionnaire as a survey record', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const submitPsychologyScale = vi.fn().mockResolvedValue({
      record: {
        total_score: 6,
        analysis: '心理状态正常，建议保持规律运动。',
        completed_at: '2026-04-11T15:30:00.000Z',
        scale_info: {
          id: 1,
          title: '运动心理健康量表（第1次）',
          description: '评估运动对心理健康的影响',
          order: 1,
          created_at: '2026-04-11T09:00:00.000Z',
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
            },
            {
              id: 12,
              question_text: '运动后您的心情如何？',
              question_type: 'SINGLE',
              order: 2,
              options: [
                { id: 103, option_text: '非常愉悦', score: 5, order: 1 },
                { id: 104, option_text: '比较愉悦', score: 4, order: 2 }
              ]
            }
          ]
        }
      }
    })

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      submitPsychologyScale
    })

    const result = await sync.syncLongQuestionnaire({
      checkpoint: 'week4',
      scaleId: 1,
      answers: {
        11: 101,
        12: 104
      },
      title: '运动心理健康量表（第1次）'
    })

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(submitPsychologyScale).toHaveBeenCalledWith({
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
    expect(result).toEqual({
      synced: true,
      score: 6,
      percentage: 60,
      analysis: '心理状态正常，建议保持规律运动。',
      submittedAt: '2026-04-11T15:30:00.000Z'
    })
  })

  it('syncs a visual session by finding a matching backend video first', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const listExerciseVideos = vi.fn().mockResolvedValue([
      { id: 9, exercise_type: 'MARTIAL_ARTS', title: '马步冲拳' }
    ])
    const createExerciseRecord = vi.fn().mockResolvedValue({
      id: 12,
      video: 9,
      duration: 30,
      score: '88.50',
      comment: '动作基本标准，注意细节。',
      status: 'COMPLETED',
      created_at: '2026-05-04T10:00:00Z',
      video_info: {
        id: 9,
        title: '马步冲拳',
        exercise_type: 'MARTIAL_ARTS'
      }
    })

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      listExerciseVideos,
      createExerciseRecord
    })

    const result = await sync.syncVisualSession({
      sessionId: 'visual-session-123',
      modality: 'wushu',
      durationSeconds: 30,
      score: 88.5,
      comment: '动作基本标准，注意细节。',
      poseAnalysis: {
        schema_version: '0.1',
        sequence_id: 'student_123',
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
            values: [null, null, null, null, null, null, Math.PI / 2, null, 0.1]
          }
        ]
      }
    })

    expect(listExerciseVideos).toHaveBeenCalledWith('MARTIAL_ARTS')
    expect(createExerciseRecord).toHaveBeenCalledWith({
      video: 9,
      duration: 30,
      training_session_id: 'visual-session-123',
      score: 88.5,
      comment: '动作基本标准，注意细节。',
      poseAnalysis: {
        schema_version: '0.1',
        sequence_id: 'student_123',
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
            values: [null, null, null, null, null, null, Math.PI / 2, null, 0.1]
          }
        ]
      }
    })
    expect(result).toEqual({
      synced: true,
      record: expect.objectContaining({
        id: 12,
        score: '88.50',
        comment: '动作基本标准，注意细节。',
        status: 'COMPLETED'
      })
    })
  })

  it('loads the first playable arrangement and resolves nested asset URLs', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api')
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const listExerciseArrangements = vi.fn().mockResolvedValue([
      {
        id: 6,
        title: 'HIIT 入门',
        exercise_type: 'HIIT',
        item_count: 1,
        total_duration: 30,
        is_active: true,
        order: 1
      }
    ])
    const getExerciseArrangement = vi.fn().mockResolvedValue({
      id: 6,
      title: 'HIIT 入门',
      exercise_type: 'HIIT',
      item_count: 1,
      total_duration: 30,
      is_active: true,
      order: 1,
      items: [{
        id: 61,
        video_id: 9,
        video: {
          id: 9,
          exercise_type: 'HIIT',
          title: '徒手深蹲',
          video_file: '/media/hiit.mp4',
          standard_data_url: '/media/hiit.json'
        },
        expected_duration: 30,
        countdown_duration: 3,
        rest_duration: 10,
        standard_data_url: '/media/hiit.json',
        order: 1
      }]
    })
    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      listExerciseArrangements,
      getExerciseArrangement
    })

    await expect(sync.loadVisualExerciseArrangement('hiit')).resolves.toMatchObject({
      id: 6,
      exercise_type: 'HIIT',
      items: [{
        video: {
          id: 9,
          title: '徒手深蹲',
          video_file: 'https://api.example.com/media/hiit.mp4',
          standard_data_url: 'https://api.example.com/media/hiit.json'
        },
        standard_data_url: 'https://api.example.com/media/hiit.json'
      }]
    })
    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(listExerciseArrangements).toHaveBeenCalledWith('HIIT')
    expect(getExerciseArrangement).toHaveBeenCalledWith(6)
    vi.unstubAllEnvs()
  })

  it('syncs a stair session through the stairs endpoint', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const createStairsRecord = vi.fn().mockResolvedValue(undefined)

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      createStairsRecord
    })

    await sync.syncStairSession({
      sessionId: 'stairs-session-123',
      durationSeconds: 26,
      completedIntervals: 1,
      qualityScore: 81,
      summary: '节奏稳定。'
    })

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(createStairsRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 26,
        training_session_id: 'stairs-session-123'
      })
    )
  })

  it('replays an ambiguous visual POST with the exact durable session payload', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const pending = createPendingSubmissionStore()
    const createExerciseRecord = vi.fn()
      .mockRejectedValueOnce(new Error('request timeout'))
      .mockResolvedValueOnce({ id: 12, status: 'COMPLETED' })
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        listExerciseVideos: vi.fn().mockResolvedValue([
          { id: 9, exercise_type: 'MARTIAL_ARTS', title: '马步冲拳' }
        ]),
        createExerciseRecord
      },
      {},
      { pendingSubmissions: pending.store }
    )

    await expect(sync.syncVisualSession({
      sessionId: 'durable-visual-session',
      modality: 'wushu',
      durationSeconds: 30
    })).rejects.toThrow('request timeout')
    expect(pending.entries.has('durable-visual-session')).toBe(true)

    await expect(sync.retryPendingTrainingSubmissions()).resolves.toEqual({
      attempted: 1,
      succeeded: 1
    })
    expect(createExerciseRecord).toHaveBeenCalledTimes(2)
    expect(createExerciseRecord.mock.calls[1]?.[0]).toEqual(
      createExerciseRecord.mock.calls[0]?.[0]
    )
    expect(createExerciseRecord.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      training_session_id: 'durable-visual-session'
    }))
    expect(pending.entries.size).toBe(0)
  })

  it('queues a visual completion before session bootstrap and replays it later', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const pending = createPendingSubmissionStore()
    const ensureSession = vi.fn()
      .mockRejectedValueOnce(new Error('login unavailable'))
      .mockResolvedValueOnce(undefined)
    const createExerciseRecord = vi.fn().mockResolvedValue({ id: 31, status: 'COMPLETED' })
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession,
        listExerciseVideos: vi.fn().mockResolvedValue([
          { id: 9, exercise_type: 'MARTIAL_ARTS', title: '马步冲拳' }
        ]),
        createExerciseRecord
      },
      {},
      { pendingSubmissions: pending.store }
    )

    await expect(sync.syncVisualSession({
      sessionId: 'visual-before-login',
      modality: 'wushu',
      durationSeconds: 30
    })).rejects.toThrow('login unavailable')
    expect(pending.store.save.mock.invocationCallOrder[0]).toBeLessThan(
      ensureSession.mock.invocationCallOrder[0]
    )
    expect(pending.entries.get('visual-before-login')).toEqual(expect.objectContaining({
      sessionId: 'visual-before-login',
      kind: 'visual',
      modality: 'wushu',
      durationSeconds: 30
    }))

    await expect(sync.retryPendingTrainingSubmissions()).resolves.toEqual({
      attempted: 1,
      succeeded: 1
    })
    expect(createExerciseRecord).toHaveBeenCalledWith(expect.objectContaining({
      training_session_id: 'visual-before-login'
    }))
    expect(pending.entries.size).toBe(0)
  })

  it('keeps a visual completion when video lookup fails and resolves it on replay', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const pending = createPendingSubmissionStore()
    const listExerciseVideos = vi.fn()
      .mockRejectedValueOnce(new Error('video list unavailable'))
      .mockResolvedValueOnce([
        { id: 19, exercise_type: 'HIIT', title: 'HIIT' }
      ])
    const createExerciseRecord = vi.fn().mockResolvedValue({ id: 32, status: 'COMPLETED' })
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        listExerciseVideos,
        createExerciseRecord
      },
      {},
      { pendingSubmissions: pending.store }
    )

    await expect(sync.syncVisualSession({
      sessionId: 'visual-before-video',
      modality: 'hiit',
      durationSeconds: 45
    })).rejects.toThrow('video list unavailable')
    expect(pending.entries.has('visual-before-video')).toBe(true)
    expect(pending.store.save.mock.invocationCallOrder[0]).toBeLessThan(
      listExerciseVideos.mock.invocationCallOrder[0]
    )

    await expect(sync.retryPendingTrainingSubmissions()).resolves.toEqual({
      attempted: 1,
      succeeded: 1
    })
    expect(listExerciseVideos).toHaveBeenNthCalledWith(2, 'HIIT')
    expect(createExerciseRecord).toHaveBeenCalledWith(expect.objectContaining({
      duration: 45,
      training_session_id: 'visual-before-video'
    }))
    expect(pending.entries.size).toBe(0)
  })

  it('replays an ambiguous stair POST with the exact durable session payload', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const pending = createPendingSubmissionStore()
    const createStairsRecord = vi.fn()
      .mockRejectedValueOnce(new Error('request timeout'))
      .mockResolvedValueOnce({ id: 22 })
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        createStairsRecord
      },
      {},
      { pendingSubmissions: pending.store }
    )

    await expect(sync.syncStairSession({
      sessionId: 'durable-stairs-session',
      durationSeconds: 30,
      completedIntervals: 1,
      qualityScore: 80,
      summary: '完成训练。'
    })).rejects.toThrow('request timeout')
    expect(pending.entries.has('durable-stairs-session')).toBe(true)

    await expect(sync.retryPendingTrainingSubmissions()).resolves.toEqual({
      attempted: 1,
      succeeded: 1
    })
    expect(createStairsRecord).toHaveBeenCalledTimes(2)
    expect(createStairsRecord.mock.calls[1]?.[0]).toEqual(
      createStairsRecord.mock.calls[0]?.[0]
    )
    expect(createStairsRecord.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      training_session_id: 'durable-stairs-session'
    }))
    expect(pending.entries.size).toBe(0)
  })

  it('queues a stair completion before session bootstrap and replays it later', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const pending = createPendingSubmissionStore()
    const ensureSession = vi.fn()
      .mockRejectedValueOnce(new Error('login unavailable'))
      .mockResolvedValueOnce(undefined)
    const createStairsRecord = vi.fn().mockResolvedValue({ id: 33 })
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession,
        createStairsRecord
      },
      {},
      { pendingSubmissions: pending.store }
    )

    await expect(sync.syncStairSession({
      sessionId: 'stairs-before-login',
      durationSeconds: 30,
      completedIntervals: 1,
      qualityScore: 82,
      summary: '完成训练。'
    })).rejects.toThrow('login unavailable')
    expect(pending.store.save.mock.invocationCallOrder[0]).toBeLessThan(
      ensureSession.mock.invocationCallOrder[0]
    )
    expect(pending.entries.get('stairs-before-login')).toEqual(expect.objectContaining({
      sessionId: 'stairs-before-login',
      kind: 'stairs',
      durationSeconds: 30,
      qualityScore: 82
    }))

    await expect(sync.retryPendingTrainingSubmissions()).resolves.toEqual({
      attempted: 1,
      succeeded: 1
    })
    expect(createStairsRecord).toHaveBeenCalledWith(expect.objectContaining({
      training_session_id: 'stairs-before-login'
    }))
    expect(pending.entries.size).toBe(0)
  })

  it('returns null without loading adherence endpoints when backend sync is disabled', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const getMyCompliance = vi.fn()
    const getComplianceCalendar = vi.fn()
    const getComplianceTrend = vi.fn()
    const sync = createStudentBackendSync({
      isEnabled: () => false,
      ensureSession,
      getMyCompliance,
      getComplianceCalendar,
      getComplianceTrend
    })

    await expect(sync.loadAdherenceData()).resolves.toBeNull()
    expect(ensureSession).not.toHaveBeenCalled()
    expect(getMyCompliance).not.toHaveBeenCalled()
    expect(getComplianceCalendar).not.toHaveBeenCalled()
    expect(getComplianceTrend).not.toHaveBeenCalled()
  })

  it('loads and maps the backend adherence read model', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const now = new Date()
    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const getMyCompliance = vi.fn().mockResolvedValue({
      today_count: 4,
      today_completed: true,
      total_training_days: 9,
      completed_days: 5,
      compliance_rate: 0.75
    })
    const getComplianceCalendar = vi.fn().mockResolvedValue({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      days: [
        {
          date: '2026-07-01',
          day: 1,
          weekday: 3,
          training_count: 1,
          is_completed: false
        },
        {
          date: '2026-07-02',
          day: 2,
          weekday: 4,
          training_count: 3,
          is_completed: true
        },
        {
          date: '2026-07-03',
          day: 3,
          weekday: 5,
          training_count: 0,
          is_completed: false
        }
      ],
      completed_days: 1,
      total_training_count: 4
    })
    const getComplianceTrend = vi.fn().mockResolvedValue({
      type: 'weekly',
      trend: [
        {
          period: '2026-W27',
          label: '第27周',
          start_date: '2026-06-29',
          end_date: '2026-07-05',
          training_days: 3,
          total_count: 6,
          completed_days: 2,
          completion_rate: 0.67
        }
      ]
    })
    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      getMyCompliance,
      getComplianceCalendar,
      getComplianceTrend
    })

    await expect(sync.loadAdherenceData()).resolves.toEqual({
      todayCount: 4,
      todayCompleted: true,
      totalTrainingDays: 9,
      completedDays: 5,
      complianceRate: 0.75,
      calendar: [
        { date: '2026-07-01', completedSessions: 1, status: 'partial' },
        { date: '2026-07-02', completedSessions: 3, status: 'met-goal' },
        { date: '2026-07-03', completedSessions: 0, status: 'none' }
      ],
      trend: [
        {
          period: '2026-W27',
          label: '第27周',
          trainingDays: 3,
          totalCount: 6,
          completedDays: 2,
          completionRate: 0.67
        }
      ]
    })
    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(getMyCompliance).toHaveBeenCalledTimes(1)
    expect(getComplianceCalendar).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1)
    expect(getComplianceTrend).toHaveBeenCalledWith(12)
  })

  it('becomes a no-op when the backend integration is disabled', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)

    const sync = createStudentBackendSync({
      isEnabled: () => false,
      ensureSession
    })

    await sync.syncRegistration(createProfile())

    expect(ensureSession).not.toHaveBeenCalled()
  })
})
