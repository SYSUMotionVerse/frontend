import { describe, expect, it, vi } from 'vitest'
import type { StudentProfile } from '../types/student'

function createProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    avatarUrl: 'https://cdn.example.com/avatar.png',
    avatarSource: 'wechat',
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
        analysis: expect.stringContaining('https://cdn.example.com/avatar.png')
      })
    )
  })

  it('keeps registration successful when the fallback survey record write fails', async () => {
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

    await expect(sync.syncRegistration(createProfile())).resolves.toEqual({
      synced: true
    })

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(updateProfile).toHaveBeenCalledTimes(1)
    expect(createSurveyRecord).toHaveBeenCalledTimes(1)
  })

  it('uploads local avatar files during registration before writing the survey record', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const uploadAvatar = vi.fn().mockResolvedValue({
      avatarUrl: 'https://api.example.com/media/avatars/avatar.png'
    })
    const updateProfile = vi.fn().mockResolvedValue(undefined)
    const createSurveyRecord = vi.fn().mockResolvedValue(undefined)

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      uploadAvatar,
      updateProfile,
      createSurveyRecord
    })

    await sync.syncRegistration(
      createProfile({
        avatarUrl: 'wxfile://avatar.png'
      })
    )

    expect(uploadAvatar).toHaveBeenCalledWith('wxfile://avatar.png', 'wechat')
    expect(createSurveyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.stringContaining('https://api.example.com/media/avatars/avatar.png')
      })
    )
  })

  it('exposes avatar upload through the shared backend sync client', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const backendUploadAvatar = vi.fn().mockResolvedValue({
      avatarUrl: 'https://api.example.com/media/avatars/avatar.png'
    })

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      uploadAvatar: backendUploadAvatar
    })

    const result = await sync.uploadAvatar('wxfile://avatar.png', 'wechat')

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(backendUploadAvatar).toHaveBeenCalledWith('wxfile://avatar.png', 'wechat')
    expect(result).toEqual({
      avatarUrl: 'https://api.example.com/media/avatars/avatar.png'
    })
  })

  it('updates the logged-in profile avatar immediately after a direct avatar change', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const uploadAvatar = vi.fn().mockResolvedValue({
      avatarUrl: 'https://api.example.com/media/avatars/new-avatar.png'
    })
    const updateProfile = vi.fn().mockResolvedValue(undefined)

    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      uploadAvatar,
      updateProfile
    })

    const result = await sync.syncProfileAvatarChange(
      'wxfile://header-avatar.png',
      'wechat',
      createProfile()
    )

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(uploadAvatar).toHaveBeenCalledWith('wxfile://header-avatar.png', 'wechat')
    expect(updateProfile).not.toHaveBeenCalled()
    expect(result).toEqual({
      avatarUrl: 'https://api.example.com/media/avatars/new-avatar.png',
      profile: expect.objectContaining({
        avatarUrl: 'https://api.example.com/media/avatars/new-avatar.png',
        name: 'Lin',
        studentId: '20260001',
        avatarSource: 'wechat'
      })
    })
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
      modality: 'wushu',
      durationSeconds: 30
    })

    expect(listExerciseVideos).toHaveBeenCalledWith('MARTIAL_ARTS')
    expect(createExerciseRecord).toHaveBeenCalledWith({
      video: 9,
      duration: 30
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
      durationSeconds: 26,
      completedIntervals: 1,
      qualityScore: 81,
      summary: '节奏稳定。'
    })

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(createStairsRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 26
      })
    )
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
