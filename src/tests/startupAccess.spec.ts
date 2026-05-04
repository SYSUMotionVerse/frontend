import { describe, expect, it, vi } from 'vitest'
import { createInitialStudentState } from '../domain/student/state'
import type { BackendCurrentUser } from '../uni-app/api/studentBackendTypes'
import type { StudentProfile } from '../types/student'

function createSeedProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    ...createInitialStudentState().profile,
    ...overrides
  }
}

function createBackendUser(overrides: Partial<BackendCurrentUser> = {}): BackendCurrentUser {
  return {
    id: 1,
    name: 'Lin',
    gender: 2,
    student_id: '20260001',
    major: 'Sports Science',
    height: 160,
    weight: 45,
    avatar: null,
    ...overrides
  }
}

describe('startup access bootstrap', () => {
  it('maps backend user fields into a local student profile', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')

    const profile = mapBackendCurrentUserToStudentProfile(
      createBackendUser({
        avatar: 'http://127.0.0.1:8000/media/avatars/backend-avatar.png'
      }),
      createSeedProfile({
        avatarUrl: 'https://cdn.example.com/avatar.png',
        avatarSource: 'wechat',
        age: 15,
        grade: '高一',
        restingHeartRate: 68
      })
    )

    expect(profile).toEqual(
      expect.objectContaining({
        studentId: '20260001',
        name: 'Lin',
        gender: '女',
        major: 'Sports Science',
        heightCm: 160,
        weightKg: 45,
        avatarUrl: 'http://127.0.0.1:8000/media/avatars/backend-avatar.png',
        avatarSource: '',
        age: 15,
        grade: '高一',
        restingHeartRate: 68,
        completed: true
      })
    )
  })

  it('keeps local avatar values when the backend user has no avatar', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')

    const profile = mapBackendCurrentUserToStudentProfile(
      createBackendUser({
        avatar: null
      }),
      createSeedProfile({
        avatarUrl: 'https://cdn.example.com/avatar.png',
        avatarSource: 'wechat'
      })
    )

    expect(profile.avatarUrl).toBe('https://cdn.example.com/avatar.png')
    expect(profile.avatarSource).toBe('wechat')
  })

  it('marks profile incomplete when required backend fields are missing', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')

    const profile = mapBackendCurrentUserToStudentProfile(
      createBackendUser({
        student_id: null
      }),
      createSeedProfile()
    )

    expect(profile.completed).toBe(false)
  })

  it('treats decimal-string height and weight from the backend as complete profile fields', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')

    const profile = mapBackendCurrentUserToStudentProfile(
      createBackendUser({
        height: '160.00',
        weight: '45.50'
      }),
      createSeedProfile()
    )

    expect(profile.completed).toBe(true)
    expect(profile.heightCm).toBe(160)
    expect(profile.weightKg).toBe(45.5)
  })

  it('routes startup to register when profile is incomplete', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const getCurrentUser = vi.fn().mockResolvedValue(
      createBackendUser({
        major: null
      })
    )
    const listPsychologyRecords = vi.fn().mockResolvedValue([])
    const hydrateAccessState = vi.fn()
    const resolveLocalProfile = vi.fn().mockReturnValue(createSeedProfile())

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession,
        getCurrentUser,
        listPsychologyRecords
      },
      {
        hydrateAccessState,
        resolveLocalProfile
      }
    )

    const result = await sync.bootstrapAccess()

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(result.targetPageUrl).toBe('/pages/access/register')
    expect(hydrateAccessState).toHaveBeenCalledWith(
      expect.objectContaining({
        hasCompletedBaselineQuestionnaire: false,
        profile: expect.objectContaining({
          completed: false
        })
      })
    )
  })

  it('routes startup to baseline questionnaire when profile is complete but baseline record is missing', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([])
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createSeedProfile())
      }
    )

    const result = await sync.bootstrapAccess()

    expect(result.targetPageUrl).toBe('/pages/access/questionnaire?checkpoint=baseline')
  })

  it('routes startup to home when profile and baseline record are both completed', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([
          {
            id: 99
          }
        ])
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createSeedProfile())
      }
    )

    const result = await sync.bootstrapAccess()

    expect(result.targetPageUrl).toBe('/pages/training/home')
  })
})

describe('student store startup hydration', () => {
  it('hydrates backend access state into local profile and baseline questionnaire', async () => {
    const { createStudentStore } = await import('../uni-app/composables/useStudentStore')

    const store = createStudentStore()
    store.submitLongQuestionnaire('baseline', 8, 80)

    store.hydrateAccessState({
      profile: createSeedProfile({
        studentId: '20260008',
        name: 'Wei',
        gender: '男',
        major: 'PE',
        heightCm: 172,
        weightKg: 60,
        completed: true
      }),
      hasCompletedBaselineQuestionnaire: false
    })

    const snapshot = store.getSnapshot()

    expect(snapshot.profile.name).toBe('Wei')
    expect(snapshot.profile.studentId).toBe('20260008')
    expect(snapshot.longQuestionnaires.baseline.completed).toBe(false)
    expect(snapshot.longQuestionnaires.baseline.score).toBeNull()
  })
})
