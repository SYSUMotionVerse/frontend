import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createInitialStudentState } from '../domain/student/state'

const initialStudentState = createInitialStudentState()

const store = {
  getSnapshot: vi.fn(() => initialStudentState),
  completeProfile: vi.fn(),
  setActiveCheckpoint: vi.fn(),
  submitLongQuestionnaire: vi.fn(),
  completeTrainingSession: vi.fn(),
  submitShortQuestionnaireForLatestSession: vi.fn(),
  refreshReminderEligibility: vi.fn(),
  state: {
    profile: {
      name: ''
    },
    dailyAdherence: {
      validCheckIns: 0,
      reminderEligible: true
    },
    weeklyAdherence: {
      qualifyingDays: 0
    }
  }
}

const studentBackendSync = {
  bootstrapAccess: vi.fn().mockResolvedValue({
    targetPageUrl: '/pages/training/home'
  }),
  syncRegistration: vi.fn().mockResolvedValue({ synced: true }),
  syncShortQuestionnaire: vi.fn().mockResolvedValue({
    synced: false,
    reason: 'pending-backend-endpoint'
  }),
  retryPendingShortQuestionnaires: vi.fn().mockResolvedValue({
    attempted: 0,
    succeeded: 0
  }),
  loadLongQuestionnaire: vi.fn().mockResolvedValue({
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
  }),
  syncLongQuestionnaire: vi.fn().mockResolvedValue({
    synced: true,
    score: 6,
    percentage: 60,
    analysis: '心理状态正常，建议保持规律运动。',
    submittedAt: '2026-04-09T15:30:00.000Z'
  }),
  syncVisualSession: vi.fn().mockResolvedValue({
    synced: true,
    record: {
      id: 1,
      score: '88.50',
      comment: '动作基本标准，注意细节。',
      status: 'COMPLETED'
    }
  }),
  loadVisualExerciseVideo: vi.fn().mockResolvedValue({
    id: 9,
    title: '马步冲拳',
    exercise_type: 'MARTIAL_ARTS',
    video_file: 'https://cdn.example.com/wushu.mp4',
    duration: 42
  }),
  syncStairSession: vi.fn().mockResolvedValue({ synced: true }),
  loadGrowthHistory: vi.fn().mockResolvedValue({
    assessments: [
      {
        checkpoint: 'baseline',
        title: '运动心理健康量表（第1次）',
        score: 12,
        percentage: 60,
        submittedAt: '2026-04-09T15:30:00.000Z'
      }
    ],
    trainingSessions: [
      {
        id: 'visual-1',
        modality: 'wushu',
        date: '2026-04-09',
        summary: '动作基本标准，注意细节。',
        qualityScore: 89
      }
    ]
  }),
  loadPhysicalMetrics: vi.fn().mockResolvedValue([
    {
      label: 'BMI',
      unit: '',
      values: [19.4, 19.1]
    }
  ]),
  loadAdherenceData: vi.fn().mockResolvedValue(null)
}

const stairSensorCaptureSession = {
  getSnapshot: vi.fn(),
  stop: vi.fn()
}

const startStairSensorCapture = vi.fn()
const notifyTrainingComplete = vi.fn()

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onShow: vi.fn(),
  onBeforeUnmount: vi.fn()
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => store
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync,
  buildVisualPoseAnalysisPayload: (frames: unknown[]) => frames.length === 0 ? undefined : ({
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
    frames: (frames as Array<{ tsMs: number; angles: Record<string, number>; bodyRotationRad?: number }>).map(
      (frame, index) => ({
        frame_index: index,
        time: 0,
        values: [
          null,
          null,
          null,
          null,
          null,
          null,
          frame.angles.leftKnee ?? null,
          null,
          frame.bodyRotationRad ?? null
        ]
      })
    )
  })
}))

vi.mock('../uni-app/platform/sensors', async () => {
  const actual = await vi.importActual<typeof import('../uni-app/platform/sensors')>('../uni-app/platform/sensors')

  return {
    ...actual,
    startStairSensorCapture
  }
})

vi.mock('../uni-app/platform/trainingFeedback', () => ({
  notifyTrainingComplete
}))

vi.mock('../subpackages/training/components/pose/PoseDetectionView.vue', () => ({
  default: defineComponent({
    name: 'PoseDetectionView',
    props: {
      onResult: {
        type: Function,
        required: false
      },
      onStats: {
        type: Function,
        required: false
      }
    },
    setup(props, { expose }) {
      const emitPoseResult = () => props.onResult?.({
        pose: {
          keypoints: []
        },
        inferMs: 16,
        tsMs: 123,
        angleFrame: {
          tsMs: 123,
          angles: {
            leftKnee: Math.PI / 2
          },
          bodyRotationRad: 0.25
        }
      })

      expose({
        startDetect() {
          emitPoseResult()
        },
        startRecord: async () => undefined,
        stopRecord: async () => ''
      })

      return () => h('button', { class: 'pose-detection-view-stub', onClick: emitPoseResult }, 'pose')
    }
  })
}))

function currentUni() {
  return (globalThis as typeof globalThis & {
    uni: {
      redirectTo: ReturnType<typeof vi.fn>
      navigateTo: ReturnType<typeof vi.fn>
      reLaunch: ReturnType<typeof vi.fn>
    }
  }).uni
}

describe('page-level backend sync wiring', () => {
  beforeEach(() => {
    vi.useRealTimers()
    Object.values(store).forEach(value => {
      if (typeof value === 'function' && 'mockReset' in value) {
        value.mockReset()
      }
    })

    Object.values(studentBackendSync).forEach(value => {
      value.mockReset()
      value.mockResolvedValue({ synced: true })
    })

    store.getSnapshot.mockReturnValue(initialStudentState)
    studentBackendSync.loadAdherenceData.mockResolvedValue(null)

    stairSensorCaptureSession.getSnapshot.mockReset()
    stairSensorCaptureSession.stop.mockReset()
    stairSensorCaptureSession.getSnapshot.mockReturnValue({
      samples: [],
      latestGyroscope: null,
      analysis: {
        qualityScore: 0,
        summary: '等待采样',
        capturedBy: 'sensor',
        estimatedStepCount: 0,
        activeClimbSeconds: 0,
        cadenceSpmAvg: 0,
        cadenceSpmPeak: 0,
        cadenceStability: 0,
        estimatedVerticalSpeedMps: 0,
        estimatedFloorsPerMin: 0,
        pauseCount: 0,
        confidence: 0,
        completedIntervals: 0,
        durationSeconds: 0
      }
    })
    stairSensorCaptureSession.stop.mockResolvedValue({
      samples: [
        {
          timestampMs: 1000,
          acceleration: { x: 13.4, y: 0, z: 0 }
        }
      ],
      analysis: {
        qualityScore: 88,
        summary: '本次楼梯训练节奏稳定，全程几乎没有停顿，完成度较好。本次识别把握较高。',
        capturedBy: 'sensor',
        estimatedStepCount: 64,
        activeClimbSeconds: 26.4,
        cadenceSpmAvg: 128,
        cadenceSpmPeak: 144,
        cadenceStability: 0.84,
        estimatedVerticalSpeedMps: 0.41,
        estimatedFloorsPerMin: 2.73,
        pauseCount: 0,
        confidence: 0.88,
        completedIntervals: 1,
        durationSeconds: 30
      }
    })
    startStairSensorCapture.mockReset()
    startStairSensorCapture.mockResolvedValue(stairSensorCaptureSession)
    notifyTrainingComplete.mockReset()
    notifyTrainingComplete.mockResolvedValue(undefined)

    studentBackendSync.bootstrapAccess.mockResolvedValue({
      targetPageUrl: '/pages/training/home'
    })
    studentBackendSync.loadVisualExerciseVideo.mockResolvedValue({
      id: 9,
      title: '马步冲拳',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/wushu.mp4',
      duration: 42
    })

    ;(globalThis as typeof globalThis & { uni: Record<string, ReturnType<typeof vi.fn>> }).uni = {
      redirectTo: vi.fn().mockResolvedValue(undefined),
      navigateTo: vi.fn().mockResolvedValue(undefined),
      reLaunch: vi.fn().mockResolvedValue(undefined)
    }
  })

  it('reLaunches to registration when bootstrap resolves that route', async () => {
    studentBackendSync.bootstrapAccess.mockResolvedValue({
      targetPageUrl: '/pages/access/register'
    })

    const StartupPage = (await import('../uni-app/pages/access/startup.vue')).default
    mount(StartupPage)
    await flushPromises()

    expect(studentBackendSync.bootstrapAccess).toHaveBeenCalledTimes(1)
    expect(currentUni().reLaunch).toHaveBeenCalledWith({
      url: '/pages/access/register'
    })
  })

  it('reLaunches to baseline questionnaire when bootstrap resolves that route', async () => {
    studentBackendSync.bootstrapAccess.mockResolvedValue({
      targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline'
    })

    const StartupPage = (await import('../uni-app/pages/access/startup.vue')).default
    mount(StartupPage)
    await flushPromises()

    expect(studentBackendSync.bootstrapAccess).toHaveBeenCalledTimes(1)
    expect(currentUni().reLaunch).toHaveBeenCalledWith({
      url: '/pages/access/questionnaire?checkpoint=baseline'
    })
  })

  it('reLaunches to home when bootstrap resolves that route', async () => {
    studentBackendSync.bootstrapAccess.mockResolvedValue({
      targetPageUrl: '/pages/training/home'
    })

    const StartupPage = (await import('../uni-app/pages/access/startup.vue')).default
    mount(StartupPage)
    await flushPromises()

    expect(studentBackendSync.bootstrapAccess).toHaveBeenCalledTimes(1)
    expect(currentUni().reLaunch).toHaveBeenCalledWith({
      url: '/pages/training/home'
    })
  })

  it('retries bootstrap once and then shows an error state', async () => {
    studentBackendSync.bootstrapAccess.mockRejectedValue(new Error('network fail'))

    const StartupPage = (await import('../uni-app/pages/access/startup.vue')).default
    const wrapper = mount(StartupPage)
    await flushPromises()

    expect(studentBackendSync.bootstrapAccess).toHaveBeenCalledTimes(2)
    expect(currentUni().reLaunch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('连接失败')
    expect(wrapper.find('.retry-button').exists()).toBe(true)
  })

  it('does not expose a test-only visual session shortcut when startup backend bootstrap fails', async () => {
    studentBackendSync.bootstrapAccess.mockRejectedValue(new Error('request:fail url not in domain list'))

    const StartupPage = (await import('../uni-app/pages/access/startup.vue')).default
    const wrapper = mount(StartupPage)
    await flushPromises()

    expect(wrapper.find('.fps-test-button').exists()).toBe(false)
  })

  it('syncs registration before moving into the questionnaire flow', async () => {
    const RegisterPage = (await import('../uni-app/pages/access/register.vue')).default
    const wrapper = mount(RegisterPage, {
      global: {
        stubs: {
          UniAccessPageShell: {
            template: '<div><slot /></div>'
          },
          RegistrationForm: {
            template: '<button class="submit-registration" @click="$emit(\'submit\', payload)">submit</button>',
            data: () => ({
              payload: {
                studentId: '20260001',
                name: 'Lin',
                gender: '女',
                age: 12,
                major: 'Sports Science',
                grade: '一年级',
                heightCm: 160,
                weightKg: 45,
                restingHeartRate: 72
              }
            })
          }
        }
      }
    })

    await wrapper.get('.submit-registration').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: '20260001'
      })
    )
    expect(store.completeProfile).toHaveBeenCalled()
    expect(store.setActiveCheckpoint).toHaveBeenCalledWith('baseline')
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/access/questionnaire?checkpoint=baseline'
    })
  })

  it('keeps the student on registration when backend profile sync fails', async () => {
    studentBackendSync.syncRegistration.mockRejectedValueOnce(new Error('network fail'))

    const RegisterPage = (await import('../uni-app/pages/access/register.vue')).default
    const wrapper = mount(RegisterPage, {
      global: {
        stubs: {
          UniAccessPageShell: {
            template: '<div><slot /></div>'
          },
          RegistrationForm: {
            template: '<button class="submit-registration" @click="$emit(\'submit\', payload)">submit</button>',
            data: () => ({
              payload: {
                studentId: '20260002',
                name: 'Wei',
                gender: '男',
                age: 19,
                major: 'Sports Science',
                grade: '一年级',
                heightCm: 172,
                weightKg: 62,
                restingHeartRate: 68
              }
            })
          }
        }
      }
    })

    await wrapper.get('.submit-registration').trigger('click')
    await flushPromises()

    expect(store.completeProfile).not.toHaveBeenCalled()
    expect(store.setActiveCheckpoint).not.toHaveBeenCalled()
    expect(currentUni().redirectTo).not.toHaveBeenCalled()
  })

  it('syncs the long questionnaire payload and replaces the questionnaire page in the stack', async () => {
    studentBackendSync.syncLongQuestionnaire.mockResolvedValue({
      synced: true,
      score: 6,
      percentage: 60,
      analysis: '心理状态正常，建议保持规律运动。',
      submittedAt: '2026-04-09T15:30:00.000Z'
    })

    const QuestionnairePage = (await import('../uni-app/pages/access/questionnaire.vue')).default
    const wrapper = mount(QuestionnairePage, {
      global: {
        stubs: {
          UniAccessPageShell: {
            template: '<div><slot /></div>'
          },
          LongQuestionnaireForm: {
            template: '<button class="submit-questionnaire" @click="$emit(\'submit\', payload)">submit</button>',
            data: () => ({
              payload: {
                scaleId: 1,
                answers: {
                  11: 101
                },
                title: '运动心理健康量表（第1次）'
              }
            })
          }
        }
      }
    })

    await flushPromises()
    await wrapper.get('.submit-questionnaire').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncLongQuestionnaire).toHaveBeenCalledWith(
      {
        checkpoint: 'baseline',
        scaleId: 1,
        answers: {
          11: 101
        },
        title: '运动心理健康量表（第1次）'
      }
    )
    expect(store.submitLongQuestionnaire).toHaveBeenCalledWith('baseline', 6, 60)
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/access/questionnaire-result?checkpoint=baseline&score=6&percentage=60&submittedAt=2026-04-09T15%3A30%3A00.000Z'
    })
    expect(currentUni().navigateTo).not.toHaveBeenCalled()
  })

  it('reLaunches from the baseline questionnaire result into reminder consent', async () => {
    const ResultPage = (await import('../uni-app/pages/access/questionnaire-result.vue')).default
    const wrapper = mount(ResultPage, {
      global: {
        stubs: {
          UniAccessPageShell: {
            template: '<div><slot /></div>'
          },
          QuestionnaireResultCard: {
            template: '<button class="continue-to-home" @click="$emit(\'continue\')">continue</button>'
          }
        }
      }
    })

    await wrapper.get('.continue-to-home').trigger('click')
    await flushPromises()

    expect(currentUni().reLaunch).toHaveBeenCalledWith({
      url: '/pages/access/reminder-consent'
    })
    expect(currentUni().redirectTo).not.toHaveBeenCalledWith({
      url: '/pages/training/home'
    })
  })

  it('renders loaded adherence stats and the backend calendar with a capped daily count', async () => {
    studentBackendSync.loadAdherenceData.mockResolvedValue({
      todayCount: 4,
      todayCompleted: true,
      totalTrainingDays: 9,
      completedDays: 5,
      complianceRate: 0.75,
      calendar: [
        { date: '2026-07-01', completedSessions: 1, status: 'partial' },
        { date: '2026-07-02', completedSessions: 3, status: 'met-goal' }
      ],
      trend: [
        {
          period: '2026-W27',
          label: '第27周',
          trainingDays: 3,
          totalCount: 6,
          completedDays: 2,
          completionRate: 0.75
        }
      ]
    })

    const AdherencePage = (await import('../uni-app/pages/growth/adherence.vue')).default
    const wrapper = mount(AdherencePage, {
      global: {
        stubs: {
          UniGrowthPageShell: {
            template: '<div><slot /></div>'
          }
        }
      }
    })
    await flushPromises()

    expect(studentBackendSync.loadAdherenceData).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('3/3')
    expect(wrapper.text()).not.toContain('4/3')
    expect(wrapper.text()).toContain('75%')
    expect(wrapper.findAll('.adherence-cell')).toHaveLength(2)
    expect(wrapper.find('.adherence-cell--partial').attributes('title')).toContain('2026-07-01')
    expect(wrapper.find('.adherence-cell--met').attributes('title')).toContain('2026-07-02')
  })

  it('keeps the local adherence heatmap fallback when backend data is unavailable', async () => {
    studentBackendSync.loadAdherenceData.mockResolvedValue(null)

    const AdherencePage = (await import('../uni-app/pages/growth/adherence.vue')).default
    const wrapper = mount(AdherencePage, {
      global: {
        stubs: {
          UniGrowthPageShell: {
            template: '<div><slot /></div>'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.find('.detail-page__stats').exists()).toBe(false)
    expect(wrapper.findAll('.adherence-cell')).toHaveLength(28)
  })

  it('keeps a short questionnaire visibly pending instead of claiming server completion', async () => {
    store.getSnapshot.mockReturnValue({
      ...initialStudentState,
      sessions: [{
        id: 'session-short-1',
        modality: 'hiit',
        date: '2026-07-18',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 88,
          summary: '节奏稳定',
          capturedBy: 'camera'
        }
      }]
    })
    studentBackendSync.syncShortQuestionnaire.mockResolvedValue({
      synced: false,
      reason: 'pending-backend-endpoint'
    })

    const ShortQuestionnairePage = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(ShortQuestionnairePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          ShortQuestionnaireForm: {
            template: '<button class="submit-short" @click="$emit(\'submit\', { energyLevel: 4, confidence: 5, enjoyment: 3 })">submit</button>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncShortQuestionnaire).toHaveBeenCalledWith({
      sessionId: 'session-short-1',
      energyLevel: 4,
      confidence: 5,
      enjoyment: 3
    })
    expect(store.submitShortQuestionnaireForLatestSession).toHaveBeenCalledWith({
      energyLevel: 4,
      confidence: 5,
      enjoyment: 3
    })
    expect(wrapper.text()).toContain('反馈已安全保存在本机')
    expect(currentUni().redirectTo).not.toHaveBeenCalledWith({
      url: '/pages/training/feedback?sessionId=session-short-1'
    })
  })

  it('shows a truthful retry message and does not claim safe storage when the durable save fails', async () => {
    store.getSnapshot.mockReturnValue({
      ...initialStudentState,
      sessions: [{
        id: 'session-short-save-fail',
        modality: 'hiit',
        date: '2026-07-18',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 88,
          summary: '节奏稳定',
          capturedBy: 'camera'
        }
      }]
    })
    // Simulate a durable save / validation failure (quota, storage, or validation)
    studentBackendSync.syncShortQuestionnaire.mockRejectedValueOnce(
      new Error('storage quota exceeded')
    )

    const ShortQuestionnairePage = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(ShortQuestionnairePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          ShortQuestionnaireForm: {
            template: '<button class="submit-short" @click="$emit(\'submit\', { energyLevel: 4, confidence: 5, enjoyment: 3 })">submit</button>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    // Must NOT claim the data was safely stored
    expect(wrapper.text()).not.toContain('已安全保存在本机')
    expect(wrapper.text()).toContain('保存失败')
    expect(wrapper.text()).toContain('重试')
    // Must not update the in-memory store when the save itself failed
    expect(store.submitShortQuestionnaireForLatestSession).not.toHaveBeenCalled()
    expect(currentUni().redirectTo).not.toHaveBeenCalled()
  })

  it('keeps the short questionnaire visibly pending with a truthful message after a network sync failure', async () => {
    store.getSnapshot.mockReturnValue({
      ...initialStudentState,
      sessions: [{
        id: 'session-short-network-fail',
        modality: 'hiit',
        date: '2026-07-18',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 88,
          summary: '节奏稳定',
          capturedBy: 'camera'
        }
      }]
    })
    // Durable save succeeded but network submission failed
    studentBackendSync.syncShortQuestionnaire.mockResolvedValue({
      synced: false,
      reason: 'network-error'
    })

    const ShortQuestionnairePage = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(ShortQuestionnairePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          ShortQuestionnaireForm: {
            template: '<button class="submit-short" @click="$emit(\'submit\', { energyLevel: 4, confidence: 5, enjoyment: 3 })">submit</button>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    // The durable save DID succeed, so the truthful message says it is saved locally
    expect(wrapper.text()).toContain('反馈已安全保存在本机')
    expect(wrapper.text()).toContain('网络恢复后将自动重试')
    expect(wrapper.text()).not.toContain('待后端开放接口')
    expect(currentUni().redirectTo).not.toHaveBeenCalled()
  })

  it('continues to feedback when the short questionnaire backend seam succeeds', async () => {
    store.getSnapshot.mockReturnValue({
      ...initialStudentState,
      sessions: [{
        id: 'session-short-2',
        modality: 'wushu',
        date: '2026-07-18',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 90,
          summary: '完成稳定',
          capturedBy: 'camera'
        }
      }]
    })
    studentBackendSync.syncShortQuestionnaire.mockResolvedValue({ synced: true })

    const ShortQuestionnairePage = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(ShortQuestionnairePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          ShortQuestionnaireForm: {
            template: '<button class="submit-short" @click="$emit(\'submit\', { energyLevel: 5, confidence: 5, enjoyment: 4 })">submit</button>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/feedback?sessionId=session-short-2'
    })
  })

  it('blocks visual completion until the actual routed teaching video ends', async () => {
    studentBackendSync.syncVisualSession.mockResolvedValue({
      synced: true,
      record: {
        id: 1,
        score: '88.50',
        comment: '动作基本标准，注意细节。',
        status: 'COMPLETED'
      }
    })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            props: ['videoUrl', 'canComplete'],
            emits: ['videoTimeUpdate', 'videoEnded', 'complete'],
            methods: {
              watchVideo() {
                for (let second = 0; second <= 42; second += 1) {
                  this.$emit('videoTimeUpdate', { detail: { currentTime: second } })
                }
                this.$emit('videoEnded', { detail: { currentTime: 42 } })
              }
            },
            template: `<div>
              <span class="video-url">{{ videoUrl }}</span>
              <button class="complete-visual-session" @click="$emit('complete')">complete</button>
              <button class="end-video" @click="watchVideo">ended</button>
            </div>`
          }
        }
      }
    })

    await flushPromises()
    await wrapper.get('.complete-visual-session').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncVisualSession).not.toHaveBeenCalled()
    expect(store.completeTrainingSession).not.toHaveBeenCalled()

    await wrapper.get('.end-video').trigger('click')
    await flushPromises()
    await wrapper.get('.complete-visual-session').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncVisualSession).toHaveBeenCalledWith({
      sessionId: expect.any(String),
      modality: 'wushu',
      durationSeconds: 42
    })
    expect(store.completeTrainingSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^visual-/),
        modality: 'wushu',
        qualityScore: 89,
        summary: '动作基本标准，注意细节。'
      })
    )
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/short-questionnaire'
    })
  })

  it('blocks visual completion when the backend has no playable video', async () => {
    studentBackendSync.loadVisualExerciseVideo.mockResolvedValue(null)

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          VisualTrainingPanel: {
            props: ['videoError'],
            emits: ['complete'],
            template: '<div><span class="video-error">{{ videoError }}</span><button class="complete-visual-session" @click="$emit(\'complete\')">complete</button></div>'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.get('.video-error').text()).toContain('暂未配置')
    await wrapper.get('.complete-visual-session').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncVisualSession).not.toHaveBeenCalled()
    expect(store.completeTrainingSession).not.toHaveBeenCalled()
  })

  it('auto-completes stair sessions after 30 seconds and prevents duplicate starts before redirecting', async () => {
    vi.useFakeTimers()

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          StairTrainingPanel: {
            template: `
              <div>
                <button class="start-stair-session" @click="$emit('start')">start</button>
                <button class="interrupt-stair-session" @click="$emit('interrupt')">interrupt</button>
                <div class="cadence">{{ cadenceSpm }}</div>
                <div class="sensor-status">{{ sensorStatus }}</div>
              </div>
            `,
            props: [
              'cadenceSpm',
              'sensorStatus'
            ]
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    await wrapper.get('.start-stair-session').trigger('click')
    await flushPromises()

    expect(startStairSensorCapture).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('0')

    vi.advanceTimersByTime(30000)
    await flushPromises()

    expect(stairSensorCaptureSession.stop).toHaveBeenCalledTimes(1)
    expect(notifyTrainingComplete).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.syncStairSession).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: 30,
        summary: expect.objectContaining({
          estimatedStepCount: 64,
          cadenceSpmAvg: 128,
          estimatedVerticalSpeedMps: 0.41
        })
      })
    )
    expect(studentBackendSync.syncStairSession).toHaveBeenCalledTimes(1)
    expect(store.completeTrainingSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: expect.stringMatching(/^stairs-/) })
    )
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/short-questionnaire'
    })
  })

  it('does not record a stair session when motion sensors cannot start', async () => {
    startStairSensorCapture.mockRejectedValueOnce(
      new Error('Motion sensor APIs are unavailable.')
    )

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          StairTrainingPanel: {
            template: '<button class="start-stair-session" @click="$emit(\'start\')">start</button>'
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncStairSession).not.toHaveBeenCalled()
    expect(store.completeTrainingSession).not.toHaveBeenCalled()
    expect(currentUni().redirectTo).not.toHaveBeenCalledWith({
      url: '/pages/training/short-questionnaire'
    })
  })
})
