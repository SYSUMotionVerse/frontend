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
    age: 15,
    grade: '高一',
    resting_heart_rate: 68,
    ...overrides
  }
}

function createCompleteSeedProfile(overrides: Partial<StudentProfile> = {}) {
  return createSeedProfile({
    age: 15,
    grade: '高一',
    restingHeartRate: 68,
    ...overrides
  })
}

function createScale(order: 1 | 2 | 3 | 4) {
  return {
    id: order,
    title: `第${order}次量表`,
    description: '检查点量表',
    order,
    created_at: '2026-04-11T09:00:00Z',
    questions: [{
      id: order * 10,
      question_text: '最近状态如何？',
      question_type: 'SINGLE' as const,
      order: 1,
      options: [{ id: order * 100, option_text: '良好', score: 1, order: 1 }]
    }]
  }
}

function createCompletedScaleRecord(order: 1 | 2 | 3 | 4) {
  return {
    id: 90 + order,
    total_score: 1,
    analysis: '状态良好',
    completed_at: `2026-07-${10 + order}T10:00:00Z`,
    scale_info: createScale(order)
  }
}

function createBaselineScale(order: number) {
  return {
    id: 100 + order,
    title: `基线量表 ${order}`,
    description: '基线检查点量表',
    checkpoint: 'baseline' as const,
    order,
    created_at: '2026-08-09T10:00:00Z',
    questions: [{
      id: 1_000 + order,
      question_text: '最近状态如何？',
      question_type: 'SINGLE' as const,
      order: 1,
      options: [{ id: 10_000 + order, option_text: '良好', score: 1, order: 1 }]
    }]
  }
}

function createCompletedBaselineScaleRecord(order: number) {
  return {
    id: 200 + order,
    total_score: 1,
    analysis: '状态良好',
    completed_at: `2026-08-${String(order).padStart(2, '0')}T10:00:00Z`,
    scale_info: createBaselineScale(order)
  }
}

describe('startup access bootstrap', () => {
  it('maps backend user fields into a local student profile', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')

    const profile = mapBackendCurrentUserToStudentProfile(
      createBackendUser(),
      createSeedProfile({
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
        age: 15,
        grade: '高一',
        restingHeartRate: 68,
        completed: true
      })
    )
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
    const getNextPsychologyScale = vi.fn()
    const hydrateAccessState = vi.fn()
    const resolveLocalProfile = vi.fn().mockReturnValue(createSeedProfile())

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession,
        getCurrentUser,
        listPsychologyRecords,
        getNextPsychologyScale
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
        completedQuestionnaireCheckpoints: [],
        profile: expect.objectContaining({
          completed: false
        })
      })
    )
    expect(getNextPsychologyScale).not.toHaveBeenCalled()
  })

  it('routes startup to baseline questionnaire when profile is complete but baseline record is missing', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(1))
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    const result = await sync.bootstrapAccess()

    expect(result.targetPageUrl).toBe('/pages/access/questionnaire?checkpoint=baseline')
  })

  it('routes an incomplete multi-scale baseline plan by the backend checkpoint instead of global scale order', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const getNextPsychologyScale = vi.fn().mockResolvedValue(createBaselineScale(10))

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue(
          Array.from({ length: 9 }, (_, index) => createCompletedBaselineScaleRecord(index + 1))
        ),
        getPsychologyQuestionnairePlan: vi.fn().mockResolvedValue({
          checkpoint: 'baseline',
          questionnaire_count: 10,
          completed_questionnaire_count: 9,
          estimated_total_minutes: 20,
          current_questionnaire_id: 110,
          questionnaires: []
        }),
        getNextPsychologyScale
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).resolves.toMatchObject({
      targetPage: 'questionnaire',
      targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline',
      checkpoint: 'baseline'
    })
    expect(getNextPsychologyScale).toHaveBeenCalledTimes(1)
  })

  it('routes startup to a due week 4 questionnaire from backend next-scale truth', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')

    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([createCompletedScaleRecord(1)]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(2))
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    const result = await sync.bootstrapAccess()

    expect(result.targetPageUrl).toBe('/pages/access/questionnaire?checkpoint=week4')
  })

  it.each([
    [3, 'week8'],
    [4, 'week12']
  ] as const)('routes scale order %s to the %s checkpoint', async (order, checkpoint) => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue(
          Array.from({ length: order - 1 }, (_, index) =>
            createCompletedScaleRecord((index + 1) as 1 | 2 | 3))
        ),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(order))
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).resolves.toMatchObject({
      targetPageUrl: `/pages/access/questionnaire?checkpoint=${checkpoint}`
    })
  })

  it('uses backend study fields as authoritative over durable local storage', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const hydrateAccessState = vi.fn()
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(1))
      },
      {
        hydrateAccessState,
        resolveLocalProfile: vi.fn().mockReturnValue(createSeedProfile())
      },
      {
        registrationProfileStorage: {
          load: vi.fn().mockReturnValue(createCompleteSeedProfile({
            age: 16,
            grade: '高二',
            restingHeartRate: 66
          })),
          save: vi.fn(),
          clear: vi.fn()
        }
      }
    )

    await expect(sync.bootstrapAccess()).resolves.toMatchObject({
      targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline'
    })
    expect(hydrateAccessState).toHaveBeenCalledWith(expect.objectContaining({
      profile: expect.objectContaining({
        age: 15,
        grade: '高一',
        restingHeartRate: 68,
        completed: true
      })
    }))
  })

  it('falls back to local storage study fields when backend does not provide them', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const hydrateAccessState = vi.fn()
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser({
          age: null,
          grade: null,
          resting_heart_rate: null
        })),
        listPsychologyRecords: vi.fn().mockResolvedValue([]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(1))
      },
      {
        hydrateAccessState,
        resolveLocalProfile: vi.fn().mockReturnValue(createSeedProfile())
      },
      {
        registrationProfileStorage: {
          load: vi.fn().mockReturnValue(createCompleteSeedProfile({
            age: 16,
            grade: '高二',
            restingHeartRate: 66
          })),
          save: vi.fn(),
          clear: vi.fn()
        }
      }
    )

    // Backend is missing study fields, so isBackendProfileComplete returns false,
    // routing to registration to collect them and sync to the backend.
    await expect(sync.bootstrapAccess()).resolves.toMatchObject({
      targetPageUrl: '/pages/access/register'
    })
    expect(hydrateAccessState).toHaveBeenCalledWith(expect.objectContaining({
      profile: expect.objectContaining({
        age: 16,
        grade: '高二',
        restingHeartRate: 66,
        completed: false
      })
    }))
  })

  it('routes startup home only when the backend reports all scales completed', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([
          createCompletedScaleRecord(1),
          createCompletedScaleRecord(2),
          createCompletedScaleRecord(3),
          createCompletedScaleRecord(4)
        ]),
        getNextPsychologyScale: vi.fn().mockResolvedValue({ message: '所有量表已完成' })
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).resolves.toMatchObject({
      targetPageUrl: '/pages/training/home'
    })
  })

  it('routes home when the only configured baseline scale is completed', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const hydrateAccessState = vi.fn()
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([
          createCompletedScaleRecord(1)
        ]),
        getNextPsychologyScale: vi.fn().mockResolvedValue({ message: '所有量表已完成' })
      },
      {
        hydrateAccessState,
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).resolves.toMatchObject({
      targetPageUrl: '/pages/training/home'
    })
    expect(hydrateAccessState).toHaveBeenCalledWith(expect.objectContaining({
      completedQuestionnaireCheckpoints: ['baseline']
    }))
  })

  it('hydrates completed checkpoint records by their backend scale order', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const hydrateAccessState = vi.fn()
    const completedScale = createScale(1)
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([{
          id: 91,
          total_score: 1,
          analysis: '状态良好',
          completed_at: '2026-07-18T10:00:00Z',
          scale_info: completedScale
        }]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(2))
      },
      {
        hydrateAccessState,
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await sync.bootstrapAccess()
    expect(hydrateAccessState).toHaveBeenCalledWith(expect.objectContaining({
      completedQuestionnaireCheckpoints: ['baseline'],
      activeCheckpoint: 'week4'
    }))
  })

  it('blocks startup when the backend cannot identify a due checkpoint', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([]),
        getNextPsychologyScale: vi.fn().mockResolvedValue({ message: '量表配置不可用' })
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).rejects.toThrow(
      'Backend could not identify the next required questionnaire checkpoint'
    )
  })

  it('blocks later checkpoints when baseline has no completion record', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(2))
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).rejects.toThrow('baseline questionnaire is not completed')
  })

  it('blocks non-sequential checkpoint records', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([
          createCompletedScaleRecord(1),
          createCompletedScaleRecord(3)
        ]),
        getNextPsychologyScale: vi.fn().mockResolvedValue(createScale(2))
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).rejects.toThrow('checkpoint records are out of order')
  })

  it('blocks home when next-scale says complete but checkpoint records are missing', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([]),
        getNextPsychologyScale: vi.fn().mockResolvedValue({ message: '所有量表已完成' })
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      }
    )

    await expect(sync.bootstrapAccess()).rejects.toThrow('baseline questionnaire is not completed')
  })

  it('triggers a non-blocking retry of pending short questionnaires after a successful authenticated bootstrap', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    type PSubmission = import('../uni-app/platform/pendingShortQuestionnaires').PendingShortQuestionnaireSubmission
    const entries = new Map<string, PSubmission>([
      ['pending-session', {
        sessionId: 'pending-session',
        response: { feelingScale: 4, feltArousalScale: 5},
        queuedAt: '2026-07-18T10:00:00.000Z'
      }]
    ])
    const pendingShortQuestionnaires = {
      list: vi.fn(() => [...entries.values()]),
      save: vi.fn((entry: PSubmission) => entries.set(entry.sessionId, entry)),
      remove: vi.fn((sessionId: string) => entries.delete(sessionId)),
      clear: vi.fn(() => entries.clear())
    }
    const submitShortQuestionnaire = vi.fn().mockResolvedValue({
      id: 1,
      training_session_id: 'pending-session',
      feeling_scale: 4,
      felt_arousal_scale: 5
    })
    const sync = createStudentBackendSync(
      {
        isEnabled: () => true,
        ensureSession: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue(createBackendUser()),
        listPsychologyRecords: vi.fn().mockResolvedValue([
          createCompletedScaleRecord(1),
          createCompletedScaleRecord(2),
          createCompletedScaleRecord(3),
          createCompletedScaleRecord(4)
        ]),
        getNextPsychologyScale: vi.fn().mockResolvedValue({ message: '所有量表已完成' }),
        submitShortQuestionnaire
      },
      {
        hydrateAccessState: vi.fn(),
        resolveLocalProfile: vi.fn().mockReturnValue(createCompleteSeedProfile())
      },
      { pendingShortQuestionnaires }
    )

    await sync.bootstrapAccess()

    // The non-blocking retry should have been triggered and succeeded,
    // removing the pending submission from the durable store.
    await vi.waitFor(() => {
      expect(submitShortQuestionnaire).toHaveBeenCalledWith({
        training_session_id: 'pending-session',
        feeling_scale: 4,
        felt_arousal_scale: 5
      })
      expect(entries.has('pending-session')).toBe(false)
    })
  })
})

describe('student store startup hydration', () => {
  it('hydrates backend access state into local profile and all checkpoint states', async () => {
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
      completedQuestionnaireCheckpoints: ['baseline'],
      activeCheckpoint: 'week4'
    })

    const snapshot = store.getSnapshot()

    expect(snapshot.profile.name).toBe('Wei')
    expect(snapshot.profile.studentId).toBe('20260008')
    expect(snapshot.longQuestionnaires.baseline.completed).toBe(true)
    expect(snapshot.longQuestionnaires.week4.completed).toBe(false)
    expect(snapshot.activeCheckpoint).toBe('week4')
  })
})
