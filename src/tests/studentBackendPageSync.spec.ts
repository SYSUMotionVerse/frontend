import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createInitialStudentState } from '../domain/student/state'

vi.mock('../uni-app/platform/trainingSoundscape', () => ({
  createDefaultTrainingWebAudioRuntime: () => undefined,
  createTrainingSoundscape: () => ({
    preload: vi.fn(),
    play: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn(),
    stop: vi.fn()
  })
}))

const initialStudentState = createInitialStudentState()

const store = {
  getSnapshot: vi.fn(() => initialStudentState),
  completeProfile: vi.fn(),
  setActiveCheckpoint: vi.fn(),
  submitLongQuestionnaire: vi.fn(),
  completeTrainingSession: vi.fn(),
  submitShortQuestionnaireForLatestSession: vi.fn(),
  submitShortQuestionnaireForSession: vi.fn(),
  refreshReminderEligibility: vi.fn(),
  state: {
    profile: {
      name: '',
      studentId: ''
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
  isEnabled: vi.fn(() => true),
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
  loadQuestionnairePlan: vi.fn().mockResolvedValue(null),
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
  prepareVisualTrainingSession: vi.fn().mockResolvedValue({
    credential: 'signed-training-credential',
    issued_at: '2026-08-24T09:59:00.000Z',
    expires_at: '2026-08-24T15:59:00.000Z'
  }),
  loadVisualExerciseVideo: vi.fn().mockResolvedValue({
    id: 9,
    title: '马步冲拳',
    exercise_type: 'MARTIAL_ARTS',
    video_file: 'https://cdn.example.com/wushu.mp4',
    duration: 42
  }),
  loadVisualExerciseArrangement: vi.fn().mockResolvedValue({
    id: 3,
    title: '武术基本功入门',
    exercise_type: 'MARTIAL_ARTS',
    item_count: 1,
    total_duration: 42,
    is_active: true,
    order: 1,
    items: [{
      id: 31,
      video_id: 9,
      video: {
        id: 9,
        title: '马步冲拳',
        exercise_type: 'MARTIAL_ARTS',
        video_file: 'https://cdn.example.com/wushu.mp4',
        duration: 42
      },
      pretraining_mode: 'FULL',
      pretraining_countdown_duration: 0,
      expected_duration: 42,
      formal_countdown_duration: 0,
      countdown_duration: 0,
      order: 1
    }]
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
  loadAdherenceData: vi.fn().mockResolvedValue(null),
  loadVisualScoreTrend: vi.fn().mockResolvedValue(null)
}

const stairSensorCaptureSession = {
  getSnapshot: vi.fn(),
  stop: vi.fn()
}

const startStairSensorCapture = vi.fn()
const notifyTrainingComplete = vi.fn()

vi.mock('@dcloudio/uni-app', () => ({
  onBackPress: vi.fn(),
  onHide: vi.fn(),
  onLoad: vi.fn(),
  onResize: vi.fn(),
  onShow: vi.fn(),
  onUnload: vi.fn(),
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
    store.state.profile.studentId = ''
    Object.values(store).forEach(value => {
      if (typeof value === 'function' && 'mockReset' in value) {
        value.mockReset()
      }
    })

    const { isEnabled, ...asyncBackendSync } = studentBackendSync
    isEnabled.mockReset()
    isEnabled.mockReturnValue(true)
    Object.values(asyncBackendSync).forEach(value => {
      value.mockReset()
      value.mockResolvedValue({ synced: true })
    })

    store.getSnapshot.mockReturnValue(initialStudentState)
    studentBackendSync.loadAdherenceData.mockResolvedValue(null)
    studentBackendSync.prepareVisualTrainingSession.mockResolvedValue({
      credential: 'signed-training-credential',
      issued_at: '2026-08-24T09:59:00.000Z',
      expires_at: '2026-08-24T15:59:00.000Z'
    })

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
        sensorCoverage: 0,
        isEligibleForCompletion: false,
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
        sensorCoverage: 1,
        isEligibleForCompletion: true,
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
    studentBackendSync.loadQuestionnairePlan.mockResolvedValue(null)
    studentBackendSync.loadVisualExerciseVideo.mockResolvedValue({
      id: 9,
      title: '马步冲拳',
      exercise_type: 'MARTIAL_ARTS',
      video_file: 'https://cdn.example.com/wushu.mp4',
      duration: 42
    })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 3,
      title: '武术基本功入门',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 42,
      is_active: true,
      order: 1,
      items: [{
        id: 31,
        video_id: 9,
        video: {
          id: 9,
          title: '马步冲拳',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/wushu.mp4',
          duration: 42
        },
        pretraining_mode: 'FULL',
        pretraining_countdown_duration: 0,
        expected_duration: 42,
        formal_countdown_duration: 0,
        countdown_duration: 0,
        order: 1
      }]
    })

    ;(globalThis as typeof globalThis & { uni: Record<string, ReturnType<typeof vi.fn>> }).uni = {
      redirectTo: vi.fn().mockResolvedValue(undefined),
      navigateTo: vi.fn().mockResolvedValue(undefined),
      reLaunch: vi.fn().mockResolvedValue(undefined),
      showToast: vi.fn().mockResolvedValue(undefined),
      request: vi.fn(),
      getStorageSync: vi.fn(),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn()
    }
  })

  it('reuses identical visual completion facts after an ambiguous submission failure', async () => {
    studentBackendSync.syncVisualSession
      .mockRejectedValueOnce(new Error('request timeout'))
      .mockResolvedValueOnce({ synced: true })
    const { useVisualTrainingSubmission } = await import(
      '../uni-app/composables/useVisualTrainingSubmission'
    )
    const submission = useVisualTrainingSubmission()
    const firstAttempt = {
      modality: 'wushu' as const,
      durationSeconds: 30,
      completedAt: '2026-08-30T10:00:00.000Z',
      comment: '首次完成事实'
    }

    await expect(submission.sync(firstAttempt)).rejects.toThrow('request timeout')
    await submission.sync({
      ...firstAttempt,
      durationSeconds: 31,
      completedAt: '2026-08-30T10:00:05.000Z',
      comment: '不应覆盖首次完成事实'
    })

    expect(studentBackendSync.syncVisualSession).toHaveBeenCalledTimes(2)
    expect(studentBackendSync.syncVisualSession.mock.calls[1]?.[0]).toEqual(
      studentBackendSync.syncVisualSession.mock.calls[0]?.[0]
    )
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

  it('shows a retry state when startup routing fails', async () => {
    currentUni().reLaunch.mockRejectedValue(new Error('reLaunch failed'))

    const StartupPage = (await import('../uni-app/pages/access/startup.vue')).default
    const wrapper = mount(StartupPage)
    await flushPromises()

    expect(currentUni().reLaunch).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('连接失败')
    expect(wrapper.find('.retry-button').exists()).toBe(true)
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
    expect(currentUni().reLaunch).toHaveBeenCalledWith({
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
    expect(wrapper.text()).toContain('资料提交失败')
  })

  it('syncs the long questionnaire payload and replaces the questionnaire page in the stack', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
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
    await wrapper.get('.questionnaire-overview__start').trigger('click')
    await nextTick()
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
    expect(wrapper.text()).toContain('本份问卷已提交')
    expect(wrapper.find('.questionnaire-page__handoff-layer').exists()).toBe(true)
    expect(wrapper.find('.questionnaire-page__form-content--held').exists()).toBe(true)
    expect(wrapper.find('.questionnaire-page__form-content--held .submit-questionnaire').exists()).toBe(true)
    expect(store.submitLongQuestionnaire).not.toHaveBeenCalled()
    expect(currentUni().redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(store.submitLongQuestionnaire).toHaveBeenCalledWith('baseline', 0, 100)
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/access/questionnaire-result?checkpoint=baseline&score=0&percentage=100&questionnaireCount=1&submittedAt=2026-04-09T15%3A30%3A00.000Z'
    })
    expect(currentUni().navigateTo).not.toHaveBeenCalled()
  })

  it('keeps a just-answered response when the runner reloads before its draft debounce finishes', async () => {
    vi.useFakeTimers()
    const draftStorage = new Map<string, unknown>()
    const questionnaire = {
      scaleId: 1,
      title: '第一份量表',
      description: '第一份',
      checkpoint: 'baseline' as const,
      questions: [{
        id: 11,
        prompt: '第一题',
        options: [{ id: 101, label: '是', score: 1 }]
      }]
    }
    studentBackendSync.loadLongQuestionnaire.mockResolvedValue(questionnaire)
    studentBackendSync.loadQuestionnairePlan.mockResolvedValue(null)
    store.state.profile.studentId = '20260001'

    const uni = currentUni() as ReturnType<typeof currentUni> & {
      getStorageSync: ReturnType<typeof vi.fn>
      setStorageSync: ReturnType<typeof vi.fn>
    }
    uni.getStorageSync.mockImplementation((key: string) => draftStorage.get(key))
    uni.setStorageSync.mockImplementation((key: string, value: unknown) => {
      draftStorage.set(key, value)
    })

    const DraftRunner = defineComponent({
      props: {
        initialAnswers: {
          type: Object,
          default: () => ({})
        }
      },
      emits: ['draftChange', 'reload'],
      setup(props, { emit }) {
        return () => h('div', { class: 'questionnaire-draft-runner' }, [
          h(
            'text',
            { class: 'questionnaire-draft-answer' },
            String((props.initialAnswers as Record<number, number>)[11] ?? '')
          ),
          h(
            'button',
            {
              class: 'questionnaire-draft-save',
              onClick: () => emit('draftChange', {
                answers: { 11: 101 },
                currentQuestionIndex: 0
              })
            },
            'save'
          ),
          h(
            'button',
            {
              class: 'questionnaire-draft-reload',
              onClick: () => emit('reload')
            },
            'reload'
          )
        ])
      }
    })

    const QuestionnairePage = (await import('../uni-app/pages/access/questionnaire.vue')).default
    const wrapper = mount(QuestionnairePage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          LongQuestionnaireForm: DraftRunner
        }
      }
    })

    await flushPromises()
    expect(wrapper.get('.questionnaire-draft-answer').text()).toBe('')

    await wrapper.get('.questionnaire-draft-save').trigger('click')
    expect(wrapper.get('.questionnaire-draft-answer').text()).toBe('101')
    expect(uni.setStorageSync).not.toHaveBeenCalled()

    await wrapper.get('.questionnaire-draft-reload').trigger('click')
    await flushPromises()

    expect(wrapper.get('.questionnaire-draft-answer').text()).toBe('101')
  })

  it('loads only the next questionnaire after an intermediate submission', async () => {
    vi.useFakeTimers()
    const firstQuestionnaire = {
      scaleId: 1,
      title: '第一份量表',
      description: '第一份',
      checkpoint: 'baseline' as const,
      questions: [{
        id: 11,
        prompt: '第一题',
        options: [{ id: 101, label: '是', score: 1 }]
      }]
    }
    const nextQuestionnaire = {
      scaleId: 2,
      title: '第二份量表',
      description: '第二份',
      checkpoint: 'baseline' as const,
      questions: [{
        id: 21,
        prompt: '第二题',
        options: [{ id: 201, label: '是', score: 1 }]
      }]
    }
    studentBackendSync.loadLongQuestionnaire
      .mockResolvedValueOnce(firstQuestionnaire)
      .mockResolvedValueOnce(nextQuestionnaire)
    studentBackendSync.loadQuestionnairePlan.mockResolvedValue({
      checkpoint: 'baseline',
      questionnaire_count: 2,
      completed_questionnaire_count: 0,
      estimated_total_minutes: 8,
      current_questionnaire_id: 1,
      questionnaires: [
        {
          id: 1,
          code: 'one',
          title: '第一份量表',
          short_title: '量表一',
          order: 1,
          estimated_minutes: 4,
          question_count: 1,
          completed: false
        },
        {
          id: 2,
          code: 'two',
          title: '第二份量表',
          short_title: '量表二',
          order: 2,
          estimated_minutes: 4,
          question_count: 1,
          completed: false
        }
      ]
    })
    studentBackendSync.syncLongQuestionnaire.mockResolvedValue({
      synced: true,
      score: 1,
      percentage: 100,
      analysis: '已完成。',
      submittedAt: '2026-08-11T10:00:00.000Z'
    })

    const QuestionnairePage = (await import('../uni-app/pages/access/questionnaire.vue')).default
    const wrapper = mount(QuestionnairePage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          LongQuestionnaireForm: {
            template: '<button class="submit-questionnaire" @click="$emit(\'submit\', payload)">submit</button>',
            data: () => ({
              payload: {
                scaleId: 1,
                answers: { 11: 101 },
                title: '第一份量表'
              }
            })
          }
        }
      }
    })

    await flushPromises()
    await wrapper.get('.questionnaire-overview__start').trigger('click')
    await nextTick()
    await wrapper.get('.submit-questionnaire').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('本份问卷已提交')
    expect(studentBackendSync.loadLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.loadQuestionnairePlan).toHaveBeenCalledTimes(1)
    expect(currentUni().redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(studentBackendSync.loadLongQuestionnaire).toHaveBeenCalledTimes(2)
  })

  it('recreates the runner from question one when the next questionnaire reuses a scale id', async () => {
    vi.useFakeTimers()
    const firstQuestionnaire = {
      scaleId: 1,
      title: '第一份量表',
      description: '第一份',
      checkpoint: 'baseline' as const,
      questions: Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        prompt: `第一份第 ${index + 1} 题`,
        options: [{ id: index + 101, label: '是', score: 1 }]
      }))
    }
    const nextQuestionnaire = {
      scaleId: 1,
      title: 'SRSS',
      description: '下一份',
      checkpoint: 'baseline' as const,
      questions: [{
        id: 101,
        prompt: 'SRSS 第一题',
        options: [{ id: 201, label: '是', score: 1 }]
      }]
    }
    studentBackendSync.loadLongQuestionnaire
      .mockResolvedValueOnce(firstQuestionnaire)
      .mockResolvedValueOnce(nextQuestionnaire)
    studentBackendSync.loadQuestionnairePlan.mockResolvedValue({
      checkpoint: 'baseline',
      questionnaire_count: 2,
      completed_questionnaire_count: 0,
      estimated_total_minutes: 8,
      current_questionnaire_id: 1,
      questionnaires: [
        {
          id: 1,
          code: 'one',
          title: '第一份量表',
          short_title: '量表一',
          order: 1,
          estimated_minutes: 4,
          question_count: 20,
          completed: false
        },
        {
          id: 2,
          code: 'srss',
          title: 'SRSS',
          short_title: 'SRSS',
          order: 2,
          estimated_minutes: 4,
          question_count: 1,
          completed: false
        }
      ]
    })
    studentBackendSync.syncLongQuestionnaire.mockResolvedValue({
      synced: true,
      score: 1,
      percentage: 100,
      analysis: '已完成。',
      submittedAt: '2026-08-14T13:00:00.000Z'
    })

    const StatefulQuestionnaireForm = defineComponent({
      props: ['questionnaire'],
      setup(props, { emit }) {
        const questionnaire = props.questionnaire as typeof firstQuestionnaire
        const firstRenderedQuestionNumber = questionnaire.questions.length

        function submit() {
          emit('submit', {
            scaleId: questionnaire.scaleId,
            answers: { 1: 101 },
            title: questionnaire.title
          })
        }

        return { firstRenderedQuestionNumber, submit }
      },
      template: `
        <button class="submit-questionnaire" @click="submit">
          <text class="runner-title">{{ questionnaire.title }}</text>
          <text class="runner-question">{{ firstRenderedQuestionNumber }}</text>
        </button>
      `
    })
    const QuestionnairePage = (await import('../uni-app/pages/access/questionnaire.vue')).default
    const wrapper = mount(QuestionnairePage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          LongQuestionnaireForm: StatefulQuestionnaireForm
        }
      }
    })

    await flushPromises()
    expect(wrapper.get('.runner-title').text()).toBe('第一份量表')
    expect(wrapper.get('.runner-question').text()).toBe('20')

    await wrapper.get('.submit-questionnaire').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(wrapper.get('.runner-title').text()).toBe('SRSS')
    expect(wrapper.get('.runner-question').text()).toBe('1')
  })

  it('keeps a confirmed questionnaire out of the resubmit path when loading the next one fails', async () => {
    vi.useFakeTimers()
    const firstQuestionnaire = {
      scaleId: 1,
      title: '第一份量表',
      description: '第一份',
      checkpoint: 'baseline' as const,
      questions: [{
        id: 11,
        prompt: '第一题',
        options: [{ id: 101, label: '是', score: 1 }]
      }]
    }
    const nextQuestionnaire = {
      scaleId: 2,
      title: '第二份量表',
      description: '第二份',
      checkpoint: 'baseline' as const,
      questions: [{
        id: 21,
        prompt: '第二题',
        options: [{ id: 201, label: '是', score: 1 }]
      }]
    }
    studentBackendSync.loadLongQuestionnaire
      .mockResolvedValueOnce(firstQuestionnaire)
      .mockRejectedValueOnce(new Error('next scale unavailable'))
      .mockResolvedValueOnce(nextQuestionnaire)
    studentBackendSync.loadQuestionnairePlan.mockResolvedValue({
      checkpoint: 'baseline',
      questionnaire_count: 2,
      completed_questionnaire_count: 0,
      estimated_total_minutes: 8,
      current_questionnaire_id: 1,
      questionnaires: [
        {
          id: 1,
          code: 'one',
          title: '第一份量表',
          short_title: '量表一',
          order: 1,
          estimated_minutes: 4,
          question_count: 1,
          completed: false
        },
        {
          id: 2,
          code: 'two',
          title: '第二份量表',
          short_title: '量表二',
          order: 2,
          estimated_minutes: 4,
          question_count: 1,
          completed: false
        }
      ]
    })
    studentBackendSync.syncLongQuestionnaire.mockResolvedValue({
      synced: true,
      score: 1,
      percentage: 100,
      analysis: '已完成。',
      submittedAt: '2026-08-13T10:00:00.000Z'
    })

    const QuestionnairePage = (await import('../uni-app/pages/access/questionnaire.vue')).default
    const wrapper = mount(QuestionnairePage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          LongQuestionnaireForm: {
            template: '<button class="submit-questionnaire" @click="$emit(\'submit\', payload)">submit</button>',
            data: () => ({
              payload: {
                scaleId: 1,
                answers: { 11: 101 },
                title: '第一份量表'
              }
            })
          }
        }
      }
    })

    await flushPromises()
    await wrapper.get('.submit-questionnaire').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('本份问卷已提交')
    expect(wrapper.text()).toContain('答案已保存，正在继续。')

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(studentBackendSync.syncLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('本份问卷已提交')
    expect(wrapper.text()).toContain('重新加载下一份')
    expect(wrapper.text()).not.toContain('问卷提交失败')
    expect(store.submitLongQuestionnaire).not.toHaveBeenCalled()
    expect(currentUni().redirectTo).not.toHaveBeenCalled()

    await wrapper.get('.questionnaire-page__next-retry').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.loadLongQuestionnaire).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).not.toContain('本份问卷已提交')
  })

  it('retries a failed questionnaire-result navigation without resubmitting answers', async () => {
    vi.useFakeTimers()
    studentBackendSync.syncLongQuestionnaire.mockResolvedValue({
      synced: true,
      score: 6,
      percentage: 60,
      analysis: '心理状态正常，建议保持规律运动。',
      submittedAt: '2026-08-13T10:00:00.000Z'
    })
    currentUni().redirectTo
      .mockRejectedValueOnce(new Error('navigation unavailable'))
      .mockResolvedValueOnce(undefined)

    const QuestionnairePage = (await import('../uni-app/pages/access/questionnaire.vue')).default
    const wrapper = mount(QuestionnairePage, {
      global: {
        stubs: {
          UniAccessPageShell: { template: '<div><slot /></div>' },
          LongQuestionnaireForm: {
            template: '<button class="submit-questionnaire" @click="$emit(\'submit\', payload)">submit</button>',
            data: () => ({
              payload: {
                scaleId: 1,
                answers: { 11: 101 },
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

    expect(wrapper.text()).toContain('本份问卷已提交')
    expect(currentUni().redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(studentBackendSync.syncLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(store.submitLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('问卷已提交，但结果页暂时无法打开。')
    expect(wrapper.text()).toContain('重新打开结果')

    await wrapper.get('.questionnaire-page__next-retry').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(store.submitLongQuestionnaire).toHaveBeenCalledTimes(1)
    expect(currentUni().redirectTo).toHaveBeenCalledTimes(2)
  })

  it('offers home and direct-training destinations after all questionnaires finish', async () => {
    const ResultPage = (await import('../uni-app/pages/access/questionnaire-result.vue')).default
    const wrapper = mount(ResultPage, {
      global: {
        stubs: {
          UniAccessPageShell: {
            template: '<div><slot /></div>'
          },
          QuestionnaireResultCard: {
            template: '<div><button class="continue-to-home" @click="$emit(\'home\')">home</button><button class="continue-to-training" @click="$emit(\'train\')">train</button></div>'
          }
        }
      }
    })

    await wrapper.get('.continue-to-home').trigger('click')
    await flushPromises()

    expect(currentUni().reLaunch).toHaveBeenCalledWith({
      url: '/pages/training/home'
    })

    await wrapper.get('.continue-to-training').trigger('click')
    await flushPromises()

    expect(currentUni().reLaunch).toHaveBeenCalledWith({
      url: '/pages/training/select'
    })
  })

  it('renders loaded adherence stats and the selectable current-month calendar with a capped daily count', async () => {
    const { invalidateGrowthOverview } = await import('../uni-app/composables/useGrowthOverview')
    invalidateGrowthOverview()
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
    const now = new Date()
    const currentMonthDayCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(wrapper.findAll('.adherence-cell:not(.adherence-cell--empty)')).toHaveLength(currentMonthDayCount)
    expect(wrapper.findAll('.adherence-cell__date')).toHaveLength(currentMonthDayCount)
    expect(wrapper.find('.adherence-cell--selected').exists()).toBe(true)
  })

  it('keeps the local adherence heatmap fallback when backend data is unavailable', async () => {
    const { invalidateGrowthOverview } = await import('../uni-app/composables/useGrowthOverview')
    invalidateGrowthOverview()
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
    const now = new Date()
    const currentMonthDayCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(wrapper.findAll('.adherence-cell:not(.adherence-cell--empty)')).toHaveLength(currentMonthDayCount)
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
            props: ['statusMessage'],
            template: '<div><button class="submit-short" @click="$emit(\'submit\', { feelingScale: 4, feltArousalScale: 5})">submit</button><text class="short-questionnaire-status">{{ statusMessage }}</text></div>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncShortQuestionnaire).toHaveBeenCalledWith({
      sessionId: 'session-short-1',
      feelingScale: 4,
      feltArousalScale: 5
    })
    expect(store.submitShortQuestionnaireForSession).toHaveBeenCalledWith('session-short-1', {
      feelingScale: 4,
      feltArousalScale: 5
    })
    expect(wrapper.text()).toContain('反馈已安全保存在本机')
    expect(currentUni().redirectTo).not.toHaveBeenCalledWith({
      url: '/pages/training/feedback?sessionId=session-short-1'
    })
  })

  it('keeps local short-questionnaire state aligned with the session in the route', async () => {
    vi.useFakeTimers()
    store.getSnapshot.mockReturnValue({
      ...initialStudentState,
      sessions: [
        {
          id: 'session-routed',
          modality: 'wushu',
          date: '2026-07-18',
          completed: true,
          validCheckInApplied: true,
          restartedAfterInterrupt: false,
          shortQuestionnaire: null,
          analysis: {
            qualityScore: 88,
            summary: '先完成的训练',
            capturedBy: 'camera'
          }
        },
        {
          id: 'session-latest',
          modality: 'hiit',
          date: '2026-07-18',
          completed: true,
          validCheckInApplied: true,
          restartedAfterInterrupt: false,
          shortQuestionnaire: null,
          analysis: {
            qualityScore: 86,
            summary: '后完成的训练',
            capturedBy: 'camera'
          }
        }
      ]
    })
    studentBackendSync.syncShortQuestionnaire.mockResolvedValue({ synced: true })

    const ShortQuestionnairePage = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(ShortQuestionnairePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          ShortQuestionnaireForm: {
            props: ['statusMessage'],
            template: '<div><button class="submit-short" @click="$emit(\'submit\', { feelingScale: 4, feltArousalScale: 5})">submit</button><text class="short-questionnaire-status">{{ statusMessage }}</text></div>'
          }
        }
      }
    })
    const uniApp = await import('@dcloudio/uni-app')
    const onLoadHandler = vi.mocked(uniApp.onLoad).mock.calls.at(-1)?.[0]

    onLoadHandler?.({ sessionId: 'session-routed' })
    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncShortQuestionnaire).toHaveBeenCalledWith({
      sessionId: 'session-routed',
      feelingScale: 4,
      feltArousalScale: 5
    })
    expect(store.submitShortQuestionnaireForSession).toHaveBeenCalledWith('session-routed', {
      feelingScale: 4,
      feltArousalScale: 5
    })
    expect(store.submitShortQuestionnaireForLatestSession).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('反馈已保存，正在打开训练反馈')
    expect(currentUni().redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/feedback?sessionId=session-routed'
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
            props: ['statusMessage'],
            template: '<div><button class="submit-short" @click="$emit(\'submit\', { feelingScale: 4, feltArousalScale: 5})">submit</button><text class="short-questionnaire-status">{{ statusMessage }}</text></div>'
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
    expect(store.submitShortQuestionnaireForSession).not.toHaveBeenCalled()
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
            props: ['statusMessage'],
            template: '<div><button class="submit-short" @click="$emit(\'submit\', { feelingScale: 4, feltArousalScale: 5})">submit</button><text class="short-questionnaire-status">{{ statusMessage }}</text></div>'
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
    vi.useFakeTimers()
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
            props: ['statusMessage'],
            template: '<div><button class="submit-short" @click="$emit(\'submit\', { feelingScale: 5, feltArousalScale: 5})">submit</button><text class="short-questionnaire-status">{{ statusMessage }}</text></div>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('反馈已保存，正在打开训练反馈')
    expect(currentUni().redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/feedback?sessionId=session-short-2'
    })
  })

  it('reopens feedback without resubmitting a short questionnaire after navigation fails', async () => {
    vi.useFakeTimers()
    store.getSnapshot.mockReturnValue({
      ...initialStudentState,
      sessions: [{
        id: 'session-short-feedback-retry',
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
    currentUni().redirectTo
      .mockRejectedValueOnce(new Error('feedback unavailable'))
      .mockResolvedValueOnce(undefined)

    const ShortQuestionnairePage = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(ShortQuestionnairePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          ShortQuestionnaireForm: {
            props: ['statusMessage'],
            template: '<div><button class="submit-short" @click="$emit(\'submit\', { feelingScale: 5, feltArousalScale: 5})">submit</button><button class="open-feedback" @click="$emit(\'openFeedback\')">open</button><text class="short-questionnaire-status">{{ statusMessage }}</text></div>'
          }
        }
      }
    })

    await wrapper.get('.submit-short').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(studentBackendSync.syncShortQuestionnaire).toHaveBeenCalledTimes(1)
    expect(store.submitShortQuestionnaireForSession).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('反馈已保存，但训练反馈页暂时无法打开。请重新打开。')
    expect(currentUni().redirectTo).toHaveBeenCalledTimes(1)

    await wrapper.get('.open-feedback').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncShortQuestionnaire).toHaveBeenCalledTimes(1)
    expect(store.submitShortQuestionnaireForSession).toHaveBeenCalledTimes(1)
    expect(currentUni().redirectTo).toHaveBeenCalledTimes(2)
  })

  it('runs pretraining guidance and transition from the configured phase clock', async () => {
    vi.useFakeTimers()
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 3,
      title: '武术基本功入门',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 13,
      is_active: true,
      order: 1,
      countdown_tts_cues: [],
      items: [{
        id: 31,
        video_id: 9,
        video: {
          id: 9,
          title: '马步冲拳',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/wushu.mp4',
          standard_data_url: 'https://cdn.example.com/guidance-wushu.json',
          duration: 8
        },
        pretraining_mode: 'FULL',
        pretraining_duration: 5,
        pretraining_countdown_duration: 0,
        expected_duration: 8,
        formal_countdown_duration: 0,
        countdown_duration: 0,
        training_tts_cues: [{
          id: 901,
          phase: 'PRETRAINING',
          timing: 'AFTER_OFFSET',
          offset_seconds: 1,
          text: '保持膝盖稳定',
          audio_url: 'https://cdn.example.com/database-guidance-01.mp3',
          order: 0
        }, {
          id: 902,
          phase: 'PRETRAINING',
          timing: 'COMPLETE',
          offset_seconds: 0,
          text: '示范结束，准备开始。',
          audio_url: 'https://cdn.example.com/pretraining-complete.mp3',
          order: 1
        }],
        order: 1
      }]
    })
    ;(globalThis as typeof globalThis & {
      uni: { request: ReturnType<typeof vi.fn> }
    }).uni.request.mockImplementation(({ success }) => {
      success({
        statusCode: 200,
        data: {
          action_id: 'wushu-punch',
          action_type: 'repetitive',
          angle_unit: 'radian',
          angle_names: ['left_knee'],
          standard_sequence: [[Math.PI / 2]],
          angle_rules: {},
          // This legacy JSON cue must not be used by the training player.
          tts_cues: [{
            time: 1,
            text: '保持膝盖稳定',
            audio_url: 'https://cdn.example.com/legacy-guidance-01.mp3'
          }]
        }
      })
    })

    const audioContext = {
      src: '',
      autoplay: false,
      obeyMuteSwitch: false,
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    }
    const createInnerAudioContext = vi.fn(() => audioContext)
    vi.stubGlobal('wx', { createInnerAudioContext })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            props: ['videoEventToken', 'videoUrl', 'phaseKind'],
            emits: ['startRecognition', 'poseStats', 'startTraining', 'videoTimeUpdate', 'videoPlay', 'videoPause', 'videoEnded'],
            template: `
              <div>
                <span class="phase-kind">{{ phaseKind }}</span>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
                <button class="demo-guidance" @click="$emit('videoTimeUpdate', { token: videoEventToken, detail: { currentTime: 1, duration: 8 } })">demo guidance</button>
                <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
                <button class="pause-video" @click="$emit('videoPause', { token: videoEventToken })">pause</button>
                <button class="end-video" @click="$emit('videoEnded', { token: videoEventToken, detail: { currentTime: 2 } })">end</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()

      // Configured second 1 is the module-entry instant, so it does not wait
      // for native video play/progress events.
      expect(createInnerAudioContext).toHaveBeenCalledOnce()
      expect(audioContext.src).toBe('https://cdn.example.com/database-guidance-01.mp3')
      expect(audioContext.play).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(1_000)
      await flushPromises()

      expect(createInnerAudioContext).toHaveBeenCalledOnce()

      // A media progress event must not restart or duplicate that cue.
      await wrapper.get('.demo-guidance').trigger('click')
      await flushPromises()

      expect(createInnerAudioContext).toHaveBeenCalledOnce()
      expect(audioContext.src).toBe('https://cdn.example.com/database-guidance-01.mp3')
      expect(audioContext.play).toHaveBeenCalledOnce()

      // The module hand-off must wait for the phase speech to finish rather
      // than cutting it off at the configured video boundary.
      audioContext.onEnded.mock.calls[0][0]()

      // The native video is eight seconds long, but the configured
      // pretraining window is five seconds. Do not emit videoEnded: the
      // configured clock must still move to the next phase on time.
      expect(wrapper.get('.phase-kind').text()).toBe('demonstration')
      await vi.advanceTimersByTimeAsync(4_000)
      await flushPromises()
      expect(audioContext.src).toBe('https://cdn.example.com/pretraining-complete.mp3')
      expect(audioContext.play).toHaveBeenCalledTimes(2)

      // The panel pauses the old video during the hand-off. That pause must
      // not stop the COMPLETE prompt that is deliberately holding the next
      // phase until its speech has finished.
      await wrapper.get('.pause-video').trigger('click')
      expect(audioContext.stop).not.toHaveBeenCalled()
      audioContext.onEnded.mock.calls[1][0]()
      await flushPromises()
      expect(wrapper.get('.phase-kind').text()).toBe('active')
      await wrapper.get('.play-video').trigger('click')
      await vi.advanceTimersByTimeAsync(2_000)
      await flushPromises()

      expect(createInnerAudioContext).toHaveBeenCalledTimes(2)
      expect(audioContext.play).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('plays a formal delayed cue from the formal phase clock after the video loops', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 4,
      title: '正式训练长于视频',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 60,
      is_active: true,
      order: 1,
      countdown_tts_cues: [],
      items: [{
        id: 41,
        video_id: 10,
        video: {
          id: 10,
          title: '长时正式训练',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/looped-formal.mp4',
          duration: 30
        },
        pretraining_mode: 'NONE',
        pretraining_countdown_duration: 0,
        expected_duration: 60,
        formal_countdown_duration: 0,
        countdown_duration: 0,
        training_tts_cues: [{
          id: 1001,
          phase: 'FORMAL',
          timing: 'AFTER_OFFSET',
          offset_seconds: 45,
          text: '保持呼吸稳定。',
          audio_url: 'https://cdn.example.com/formal-45.mp3',
          order: 0
        }],
        order: 1
      }]
    })

    const audioContext = {
      src: '',
      autoplay: false,
      obeyMuteSwitch: false,
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    }
    const createInnerAudioContext = vi.fn(() => audioContext)
    vi.stubGlobal('wx', { createInnerAudioContext })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            props: ['videoEventToken', 'phaseKind'],
            emits: ['startRecognition', 'poseStats', 'startTraining', 'videoPlay', 'videoTimeUpdate'],
            template: `
              <div>
                <span class="phase-kind">{{ phaseKind }}</span>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
                <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
                <button class="looped-video-progress" @click="$emit('videoTimeUpdate', { token: videoEventToken, detail: { currentTime: 30, duration: 30 } })">looped</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()
      expect(wrapper.get('.phase-kind').text()).toBe('active')

      await wrapper.get('.play-video').trigger('click')
      await wrapper.get('.looped-video-progress').trigger('click')
      await vi.advanceTimersByTimeAsync(45_200)
      await flushPromises()

      expect(audioContext.src).toBe('https://cdn.example.com/formal-45.mp3')
      expect(audioContext.play).toHaveBeenCalledOnce()
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('ends a countdown at its configured deadline even while its prompt finishes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 5,
      title: '倒计时语音交接',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 33,
      is_active: true,
      order: 1,
      countdown_tts_cues: [],
      items: [{
        id: 51,
        video_id: 11,
        video: {
          id: 11,
          title: '倒计时动作',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/countdown-action.mp4',
          duration: 30
        },
        pretraining_mode: 'NONE',
        pretraining_countdown_duration: 0,
        expected_duration: 30,
        formal_countdown_duration: 3,
        countdown_duration: 3,
        training_tts_cues: [{
          id: 1101,
          phase: 'FORMAL',
          timing: 'BEFORE_COUNTDOWN',
          offset_seconds: 0,
          text: '准备开始正式训练。',
          audio_url: 'https://cdn.example.com/formal-countdown-prompt.mp3',
          order: 0
        }],
        order: 1
      }]
    })

    const audioContext = {
      src: '',
      autoplay: false,
      obeyMuteSwitch: false,
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    }
    vi.stubGlobal('wx', {
      createInnerAudioContext: vi.fn(() => audioContext)
    })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            props: ['phaseKind'],
            emits: ['startRecognition', 'poseStats', 'startTraining'],
            template: `
              <div>
                <span class="phase-kind">{{ phaseKind }}</span>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()
      expect(wrapper.get('.phase-kind').text()).toBe('countdown')
      expect(audioContext.play).toHaveBeenCalledOnce()

      await vi.advanceTimersByTimeAsync(3_200)
      await flushPromises()
      expect(wrapper.get('.phase-kind').text()).toBe('active')

      audioContext.onEnded.mock.calls[0][0]()
      await flushPromises()
      expect(wrapper.get('.phase-kind').text()).toBe('active')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('keeps the formal action clock advancing while native video buffers', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 5,
      title: '缓冲恢复计时回归',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 10,
      is_active: true,
      order: 1,
      items: [{
        id: 51,
        video_id: 12,
        video: {
          id: 12,
          title: '缓冲恢复动作',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/buffering-action.mp4',
          duration: 10
        },
        pretraining_mode: 'NONE',
        pretraining_countdown_duration: 0,
        expected_duration: 10,
        formal_countdown_duration: 0,
        countdown_duration: 0,
        order: 1
      }]
    })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            props: ['videoEventToken', 'phaseKind', 'phaseRemainingSeconds'],
            emits: [
              'startRecognition',
              'poseStats',
              'startTraining',
              'videoPlay',
              'videoWaiting',
              'videoTimeUpdate'
            ],
            template: `
              <div>
                <span class="phase-kind">{{ phaseKind }}</span>
                <span class="phase-remaining">{{ phaseRemainingSeconds }}</span>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
                <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
                <button class="video-waiting" @click="$emit('videoWaiting', { token: videoEventToken })">waiting</button>
                <button class="video-progress" @click="$emit('videoTimeUpdate', { token: videoEventToken, detail: { currentTime: 1, duration: 10 } })">progress</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()

      expect(wrapper.get('.phase-kind').text()).toBe('active')
      await wrapper.get('.play-video').trigger('click')
      await vi.advanceTimersByTimeAsync(1_000)
      await flushPromises()

      await wrapper.get('.video-waiting').trigger('click')
      await flushPromises()
      const bufferingRemaining = Number(wrapper.get('.phase-remaining').text())
      await vi.advanceTimersByTimeAsync(2_000)
      expect(Number(wrapper.get('.phase-remaining').text())).toBeLessThan(bufferingRemaining)

      // Some WeChat versions resume emitting timeupdate but omit a second
      // native play event after buffering. Progress must not reset the clock.
      await wrapper.get('.video-progress').trigger('click')
      await vi.advanceTimersByTimeAsync(1_100)
      await flushPromises()

      expect(Number(wrapper.get('.phase-remaining').text())).toBeLessThan(bufferingRemaining)
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('keeps a timer-driven next phase alive after the previous action completes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 6,
      title: '阶段计时器重入回归',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 2,
      total_duration: 9,
      is_active: true,
      order: 1,
      countdown_tts_cues: [],
      items: [
        {
          id: 61,
          video_id: 13,
          video: {
            id: 13,
            title: '第一个动作',
            exercise_type: 'MARTIAL_ARTS',
            video_file: 'https://cdn.example.com/reentry-action-1.mp4',
            duration: 2
          },
          pretraining_mode: 'NONE',
          pretraining_countdown_duration: 0,
          expected_duration: 2,
          formal_countdown_duration: 0,
          countdown_duration: 0,
          order: 1
        },
        {
          id: 62,
          video_id: 14,
          video: {
            id: 14,
            title: '第二个动作',
            exercise_type: 'MARTIAL_ARTS',
            video_file: 'https://cdn.example.com/reentry-action-2.mp4',
            duration: 3
          },
          pretraining_mode: 'FIRST_FRAME',
          pretraining_duration: 3,
          pretraining_countdown_duration: 2,
          expected_duration: 2,
          formal_countdown_duration: 0,
          countdown_duration: 0,
          order: 2
        }
      ]
    })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          VisualTrainingPanel: {
            props: ['videoEventToken', 'phaseKind', 'phaseRemainingSeconds'],
            emits: ['startRecognition', 'poseStats', 'startTraining', 'videoPlay'],
            template: `
              <div>
                <span class="phase-kind">{{ phaseKind }}</span>
                <span class="phase-remaining">{{ phaseRemainingSeconds }}</span>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
                <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()
      const initialRemaining = Number(wrapper.get('.phase-remaining').text())

      // The logical action starts immediately. A late/missing native play
      // event must not add an extra frozen second at 00:00.
      await vi.advanceTimersByTimeAsync(1_100)
      await flushPromises()
      expect(Number(wrapper.get('.phase-remaining').text())).toBeLessThan(initialRemaining)

      await vi.advanceTimersByTimeAsync(1_000)
      await flushPromises()
      expect(wrapper.get('.phase-kind').text()).toBe('countdown')
      const countdownRemaining = Number(wrapper.get('.phase-remaining').text())

      await vi.advanceTimersByTimeAsync(1_100)
      await flushPromises()

      expect(Number(wrapper.get('.phase-remaining').text())).toBeLessThan(countdownRemaining)
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('does not skip a new action when the previous native video reports late progress', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 16,
      title: '迟到媒体事件回归',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 3,
      total_duration: 31,
      is_active: true,
      order: 1,
      countdown_tts_cues: [],
      items: [
        {
          id: 161,
          video_id: 161,
          video: { id: 161, title: '动作一', exercise_type: 'MARTIAL_ARTS', video_file: 'https://cdn.example.com/late-1.mp4', duration: 1 },
          pretraining_mode: 'NONE', pretraining_countdown_duration: 0,
          expected_duration: 1, formal_countdown_duration: 0, countdown_duration: 0, order: 1
        },
        {
          id: 162,
          video_id: 162,
          video: { id: 162, title: '动作二', exercise_type: 'MARTIAL_ARTS', video_file: 'https://cdn.example.com/late-2.mp4', duration: 15 },
          pretraining_mode: 'NONE', pretraining_countdown_duration: 0,
          expected_duration: 15, formal_countdown_duration: 0, countdown_duration: 0, order: 2
        },
        {
          id: 163,
          video_id: 163,
          video: { id: 163, title: '动作三', exercise_type: 'MARTIAL_ARTS', video_file: 'https://cdn.example.com/late-3.mp4', duration: 15 },
          pretraining_mode: 'NONE', pretraining_countdown_duration: 0,
          expected_duration: 15, formal_countdown_duration: 0, countdown_duration: 0, order: 3
        }
      ]
    })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const LateEventPanelStub = defineComponent({
      name: 'LateEventPanelStub',
      props: ['videoEventToken', 'videoTitle', 'phaseRemainingSeconds'],
      emits: ['startRecognition', 'poseStats', 'startTraining', 'videoPlay', 'videoTimeUpdate'],
      template: `
        <div class="training-panel-stub">
          <span class="action-title">{{ videoTitle }}</span>
          <span class="event-token">{{ videoEventToken }}</span>
          <span class="phase-remaining">{{ phaseRemainingSeconds }}</span>
          <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
          <button class="start-training" @click="$emit('startTraining')">start</button>
          <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
        </div>
      `
    })
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          VisualTrainingPanel: LateEventPanelStub
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()
      const firstToken = wrapper.get('.event-token').text()
      await wrapper.get('.play-video').trigger('click')
      await vi.advanceTimersByTimeAsync(1_100)
      await flushPromises()

      expect(wrapper.get('.action-title').text()).toBe('动作二')
      const panel = wrapper.getComponent(LateEventPanelStub)
      panel.vm.$emit('videoTimeUpdate', {
        token: firstToken,
        detail: { currentTime: 15, duration: 15 }
      })
      await flushPromises()
      expect(wrapper.get('.action-title').text()).toBe('动作二')
      expect(wrapper.get('.phase-remaining').text()).toBe('15')

      const secondToken = wrapper.get('.event-token').text()
      panel.vm.$emit('videoTimeUpdate', {
        token: secondToken,
        detail: { currentTime: 15, duration: 15 }
      })
      await flushPromises()
      expect(wrapper.get('.action-title').text()).toBe('动作二')
      expect(wrapper.get('.phase-remaining').text()).toBe('15')

      await vi.advanceTimersByTimeAsync(14_100)
      await flushPromises()
      expect(wrapper.get('.action-title').text()).toBe('动作二')
      await vi.advanceTimersByTimeAsync(1_000)
      await flushPromises()
      expect(wrapper.get('.action-title').text()).toBe('动作三')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('surfaces a retryable error when native media never starts', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 7,
      title: '视频启动看门狗回归',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 30,
      is_active: true,
      order: 1,
      items: [{
        id: 71,
        video_id: 15,
        video: {
          id: 15,
          title: '无法启动的动作',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/watchdog-action.mp4',
          duration: 30
        },
        pretraining_mode: 'NONE',
        pretraining_countdown_duration: 0,
        expected_duration: 30,
        formal_countdown_duration: 0,
        countdown_duration: 0,
        order: 1
      }]
    })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          VisualTrainingPanel: {
            props: ['videoEventToken', 'phaseKind', 'videoError'],
            emits: ['startRecognition', 'poseStats', 'startTraining', 'retryVideo'],
            template: `
              <div>
                <span class="phase-kind">{{ phaseKind }}</span>
                <span class="video-error">{{ videoError }}</span>
                <span class="video-token">{{ videoEventToken }}</span>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
                <button class="retry-video" @click="$emit('retryVideo')">retry</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()

      expect(wrapper.get('.phase-kind').text()).toBe('active')
      expect(wrapper.get('.video-error').text()).toBe('')
      const initialToken = wrapper.get('.video-token').text()

      await vi.advanceTimersByTimeAsync(15_000)
      await flushPromises()

      expect(wrapper.get('.video-error').text()).toBe('')
      expect(wrapper.get('.video-token').text()).not.toBe(initialToken)

      await vi.advanceTimersByTimeAsync(15_000)
      await flushPromises()

      expect(wrapper.get('.video-error').text()).toContain('未能开始播放')

      const arrangementLoadCount = studentBackendSync.loadVisualExerciseArrangement.mock.calls.length
      await wrapper.get('.retry-video').trigger('click')
      await flushPromises()

      expect(wrapper.get('.video-error').text()).toBe('')
      expect(studentBackendSync.loadVisualExerciseArrangement).toHaveBeenCalledTimes(arrangementLoadCount)
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('starts the next action without inserting a rest module', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 4,
      title: '两动作语音回归',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 2,
      total_duration: 13,
      is_active: true,
      order: 1,
      countdown_tts_cues: [
        { seconds_remaining: 3, text: '三', audio_url: 'https://cdn.example.com/database-countdown-3.mp3' },
        { seconds_remaining: 2, text: '二', audio_url: 'https://cdn.example.com/database-countdown-2.mp3' },
        { seconds_remaining: 1, text: '一', audio_url: 'https://cdn.example.com/database-countdown-1.mp3' }
      ],
      items: [
        {
          id: 41,
          video_id: 10,
          video: {
            id: 10,
            title: '第一个动作',
            exercise_type: 'MARTIAL_ARTS',
            video_file: 'https://cdn.example.com/action-1.mp4',
            standard_data_url: 'https://cdn.example.com/action-1-sequence.json',
            duration: 4
          },
          pretraining_mode: 'FULL',
          pretraining_countdown_duration: 0,
          expected_duration: 4,
          formal_countdown_duration: 0,
          countdown_duration: 0,
          training_tts_cues: [],
          order: 1
        },
        {
          id: 42,
          video_id: 11,
          video: {
            id: 11,
            title: '第二个动作',
            exercise_type: 'MARTIAL_ARTS',
            video_file: 'https://cdn.example.com/action-2.mp4',
            standard_data_url: 'https://cdn.example.com/action-2-sequence.json',
            duration: 4
          },
          pretraining_mode: 'FULL',
          pretraining_countdown_duration: 0,
          expected_duration: 4,
          formal_countdown_duration: 5,
          countdown_duration: 3,
          training_tts_cues: [
            {
              id: 912,
              phase: 'PRETRAINING',
              timing: 'START',
              offset_seconds: 0,
              text: '第二个动作指导',
              audio_url: 'https://cdn.example.com/database-action-2-guidance.mp3',
              order: 0
            },
            {
              id: 913,
              phase: 'FORMAL',
              timing: 'START',
              offset_seconds: 0,
              text: '第二个动作正式开始',
              audio_url: 'https://cdn.example.com/database-action-2-formal-start.mp3',
              order: 0
            }
          ],
          order: 2
        }
      ]
    })

    const legacyCountdown = {
      '3': 'https://cdn.example.com/countdown-3.mp3',
      '2': 'https://cdn.example.com/countdown-2.mp3',
      '1': 'https://cdn.example.com/countdown-1.mp3'
    }
    ;(globalThis as typeof globalThis & {
      uni: { request: ReturnType<typeof vi.fn> }
    }).uni.request.mockImplementation(({ url, success }) => {
      const isSecondAction = url.includes('action-2')
      success({
        statusCode: 200,
        data: {
          action_id: isSecondAction ? 'action-2' : 'action-1',
          action_type: 'repetitive',
          angle_unit: 'radian',
          angle_names: ['left_knee'],
          standard_sequence: [[Math.PI / 2]],
          angle_rules: {},
          countdown_audio_urls: legacyCountdown,
          transition_audio_urls: {
            start: `https://cdn.example.com/${isSecondAction ? 'action-2' : 'action-1'}-start.mp3`,
            end: `https://cdn.example.com/${isSecondAction ? 'action-2' : 'action-1'}-end.mp3`,
            ...(isSecondAction
              ? { next_action: 'https://cdn.example.com/action-2-next.mp3' }
              : {})
          },
          tts_cues: [{
            time: 0,
            text: isSecondAction ? '第二个动作指导' : '第一个动作指导',
            audio_url: `https://cdn.example.com/${isSecondAction ? 'action-2' : 'action-1'}-guidance.mp3`
          }]
        }
      })
    })

    const playedUrls: string[] = []
    const completedUrls: string[] = []
    const createInnerAudioContext = vi.fn(() => {
      let ended: (() => void) | undefined
      let playbackTimer: ReturnType<typeof setTimeout> | undefined
      return {
        src: '',
        autoplay: false,
        obeyMuteSwitch: false,
        play() {
          playedUrls.push(this.src)
          playbackTimer = setTimeout(() => {
            completedUrls.push(this.src)
            ended?.()
          }, 20)
        },
        stop() {
          if (playbackTimer) clearTimeout(playbackTimer)
        },
        destroy: vi.fn(),
        onEnded(callback: () => void) {
          ended = callback
        },
        onError: vi.fn()
      }
    })
    vi.stubGlobal('wx', { createInnerAudioContext })

    const VisualSessionPage = (await import('../subpackages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            props: ['videoEventToken', 'videoUrl'],
            emits: ['startRecognition', 'poseStats', 'startTraining', 'videoTimeUpdate', 'videoPlay', 'videoEnded'],
            template: `
              <div>
                <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
                <button class="start-training" @click="$emit('startTraining')">start</button>
                <button class="demo-guidance" @click="$emit('videoTimeUpdate', { token: videoEventToken, detail: { currentTime: 0, duration: 4 } })">demo guidance</button>
                <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
                <button class="end-video" @click="$emit('videoEnded', { token: videoEventToken, detail: { currentTime: 4 } })">end</button>
              </div>
            `
          }
        }
      }
    })

    try {
      await flushPromises()
      await wrapper.get('.start-recognition').trigger('click')
      await wrapper.get('.start-training').trigger('click')
      await flushPromises()
      await wrapper.get('.end-video').trigger('click')
      await flushPromises()
      await wrapper.get('.play-video').trigger('click')
      await vi.advanceTimersByTimeAsync(4000)
      await flushPromises()

      // The first action's four-second formal phase is also configuration
      // driven; videoEnded cannot skip either phase.
      await vi.advanceTimersByTimeAsync(4000)
      await flushPromises()

      expect(playedUrls).not.toContain('https://cdn.example.com/database-rest-go.mp3')
      expect(playedUrls).not.toContain('https://cdn.example.com/action-2-next.mp3')

      // The next action's configured start cue begins at phase entry. Native
      // video startup latency must not push it past the phase deadline.
      expect(playedUrls).toContain(
        'https://cdn.example.com/database-action-2-guidance.mp3'
      )
      await vi.advanceTimersByTimeAsync(60)
      expect(completedUrls).toContain(
        'https://cdn.example.com/database-action-2-guidance.mp3'
      )
      const secondDemoAudioCount = playedUrls.filter(url => (
        url === 'https://cdn.example.com/database-action-2-guidance.mp3'
      )).length
      await wrapper.get('.play-video').trigger('click')
      await vi.advanceTimersByTimeAsync(60)

      expect(playedUrls.filter(url => (
        url === 'https://cdn.example.com/database-action-2-guidance.mp3'
      ))).toHaveLength(secondDemoAudioCount)
      expect(playedUrls).not.toContain('https://cdn.example.com/action-2-next.mp3')

      const countdownStart = playedUrls.length
      const countdownCompletedStart = completedUrls.length
      await wrapper.get('.end-video').trigger('click')
      // 120 ms of this configured pretraining phase elapsed while its start
      // cue completed and the duplicate video play event was checked.
      await vi.advanceTimersByTimeAsync(3_880)
      await flushPromises()
      // In a five-second module countdown, 3/2/1 must wait until the last
      // three seconds rather than playing immediately at the five-second mark.
      await vi.advanceTimersByTimeAsync(1_900)
      expect(playedUrls.slice(countdownStart)).toEqual([])
      await vi.advanceTimersByTimeAsync(200)
      await vi.advanceTimersByTimeAsync(100)

      expect(playedUrls.slice(countdownStart)).toEqual([
        'https://cdn.example.com/database-countdown-3.mp3'
      ])
      await vi.advanceTimersByTimeAsync(2_000)

      expect(playedUrls.slice(countdownStart, countdownStart + 3)).toEqual([
        'https://cdn.example.com/database-countdown-3.mp3',
        'https://cdn.example.com/database-countdown-2.mp3',
        'https://cdn.example.com/database-countdown-1.mp3'
      ])
      expect(completedUrls.slice(countdownCompletedStart, countdownCompletedStart + 3)).toEqual([
        'https://cdn.example.com/database-countdown-3.mp3',
        'https://cdn.example.com/database-countdown-2.mp3',
        'https://cdn.example.com/database-countdown-1.mp3'
      ])

      const secondActionStart = playedUrls.length
      const secondActionCompleted = completedUrls.length
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      await wrapper.get('.play-video').trigger('click')
      await vi.advanceTimersByTimeAsync(60)

      const expectedSecondActionAudio = ['https://cdn.example.com/database-action-2-formal-start.mp3']
      expect(playedUrls.slice(secondActionStart)).toEqual(expectedSecondActionAudio)
      expect(completedUrls.slice(secondActionCompleted)).toEqual(expectedSecondActionAudio)
      expect(playedUrls).not.toContain(legacyCountdown['3'])
      expect(playedUrls).not.toContain(legacyCountdown['2'])
      expect(playedUrls).not.toContain(legacyCountdown['1'])
    } finally {
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('automatically submits and opens feedback after the final arranged action', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue({
      id: 3,
      title: '武术基本功入门',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 1,
      total_duration: 42,
      is_active: true,
      order: 1,
      items: [{
        id: 31,
        video_id: 9,
        video: {
          id: 9,
          title: '马步冲拳',
          exercise_type: 'MARTIAL_ARTS',
          video_file: 'https://cdn.example.com/wushu.mp4',
          standard_data_url: 'https://cdn.example.com/wushu.json',
          duration: 42
        },
        pretraining_mode: 'FULL',
        pretraining_countdown_duration: 0,
        expected_duration: 42,
        formal_countdown_duration: 0,
        countdown_duration: 0,
        order: 1
      }]
    })
    ;(globalThis as typeof globalThis & {
      uni: { request: ReturnType<typeof vi.fn> }
    }).uni.request.mockImplementation(({ success }) => {
      success({
        statusCode: 200,
        data: {
          action_id: 'wushu-punch',
          action_type: 'repetitive',
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
          standard_sequence: [[null, null, null, null, null, null, Math.PI / 2, null, null]],
          angle_rules: {
            left_knee: {
              enabled: true,
              weight: 1,
              tolerance: 0.35,
              feedback: { too_small: '', too_large: '' }
            }
          }
        }
      })
    })
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
            props: ['videoEventToken', 'videoUrl'],
            emits: ['videoTimeUpdate', 'videoPlay', 'videoEnded', 'startRecognition', 'poseStats', 'startTraining', 'poseResult'],
            template: `<div>
              <span class="video-url">{{ videoUrl }}</span>
              <button class="start-recognition" @click="$emit('startRecognition', 5); $emit('poseStats', { status: 'ready', fps: 5 })">camera</button>
              <button class="start-training" @click="$emit('startTraining')">start</button>
              <button class="play-video" @click="$emit('videoPlay', { token: videoEventToken })">play</button>
              <button class="end-video" @click="$emit('videoEnded', { token: videoEventToken, detail: { currentTime: 42 } })">end</button>
              <button class="pose-result" @click="$emit('poseResult', {
                angleFrame: {
                  tsMs: 123,
                  angles: { leftKnee: Math.PI / 2 }
                }
              })">pose</button>
            </div>`
          }
        }
      }
    })

    await flushPromises()
    await wrapper.get('.start-recognition').trigger('click')
    await wrapper.get('.start-training').trigger('click')
    await flushPromises()
    await wrapper.get('.end-video').trigger('click')
    await flushPromises()
    await wrapper.get('.play-video').trigger('click')
    await flushPromises()
    // 42 seconds of configured pretraining followed by 42 seconds formal.
    // Flush the phase hand-off between the two immutable clock windows. The
    // earlier videoEnded event must not shorten either phase.
    await vi.advanceTimersByTimeAsync(42_000)
    await flushPromises()
    await wrapper.get('.play-video').trigger('click')
    await wrapper.get('.pose-result').trigger('click')
    await vi.advanceTimersByTimeAsync(42_000)
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    await flushPromises()

    expect(studentBackendSync.syncVisualSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: expect.any(String),
      modality: 'wushu',
      durationSeconds: 84,
      videoId: 9,
      score: 100,
      comment: '教学视频已完成，本次动作评分 100 分，整体动作完成稳定。',
      poseAnalysis: expect.objectContaining({
        scoringSource: 'client',
        scoringVersion: 'action-scoring-ts-v2',
        actionScores: [expect.objectContaining({
          actionId: 'wushu-punch',
          score: 100,
          frameCount: 1
        })]
      })
    }))
    expect(store.completeTrainingSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^visual-/),
        modality: 'wushu',
        qualityScore: 89,
        summary: '动作基本标准，注意细节。'
      })
    )
    expect(currentUni().redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/^\/pages\/training\/short-questionnaire\?sessionId=visual-/)
    }))
  })

  it('blocks visual completion when the backend has no playable video', async () => {
    studentBackendSync.loadVisualExerciseArrangement.mockResolvedValue(null)

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
          cadenceSpmAvg: 128
        })
      })
    )
    expect(studentBackendSync.syncStairSession).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.syncStairSession.mock.calls[0]?.[0]?.summary).not.toHaveProperty(
      'estimatedVerticalSpeedMps'
    )
    expect(studentBackendSync.syncStairSession.mock.calls[0]?.[0]?.summary).not.toHaveProperty(
      'estimatedFloorsPerMin'
    )
    expect(store.completeTrainingSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: expect.stringMatching(/^stairs-/) })
    )
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: expect.stringMatching(/^\/pages\/training\/short-questionnaire\?sessionId=stairs-/)
    })
  })

  it('continues to the questionnaire when completion feedback fails', async () => {
    vi.useFakeTimers()
    notifyTrainingComplete.mockRejectedValueOnce(new Error('audio unavailable'))

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          StairTrainingPanel: {
            emits: ['start'],
            template: '<button class="start-stair-session" @click="$emit(\'start\')">start</button>'
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(studentBackendSync.syncStairSession).toHaveBeenCalledTimes(1)
    expect(currentUni().redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/^\/pages\/training\/short-questionnaire\?sessionId=stairs-/)
    }))
  })

  it('lets the participant retry short-questionnaire navigation after it fails', async () => {
    vi.useFakeTimers()
    currentUni().redirectTo.mockRejectedValueOnce(new Error('navigation unavailable'))

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' }
        }
      }
    })

    await wrapper.get('.stair-panel__primary-action').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(wrapper.text()).toContain('继续填写反馈')
    currentUni().redirectTo.mockResolvedValueOnce(undefined)
    await wrapper.get('.stair-panel__primary-action').trigger('click')
    await flushPromises()

    expect(currentUni().redirectTo).toHaveBeenCalledTimes(2)
  })

  it('records an unqualified sensor session without awarding training completion', async () => {
    vi.useFakeTimers()
    stairSensorCaptureSession.stop.mockResolvedValueOnce({
      samples: [],
      latestGyroscope: null,
      analysis: {
        qualityScore: 40,
        summary: '本轮传感器数据未覆盖足够的连续上楼动作，未计入训练完成；请保持手机稳定并连续上楼后重试。',
        capturedBy: 'sensor',
        estimatedStepCount: 7,
        activeClimbSeconds: 3,
        cadenceSpmAvg: 14,
        provisionalCadenceSpm: 120,
        cadenceSpmPeak: 120,
        cadenceStability: 1,
        estimatedVerticalSpeedMps: 0.4,
        estimatedFloorsPerMin: 0.24,
        pauseCount: 0,
        confidence: 0.35,
        sensorCoverage: 0.13,
        isEligibleForCompletion: false,
        completedIntervals: 0,
        durationSeconds: 30
      }
    })

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          StairTrainingPanel: {
            emits: ['start'],
            template: '<button class="start-stair-session" @click="$emit(\'start\')">start</button>'
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(studentBackendSync.syncStairSession).toHaveBeenCalledWith(expect.objectContaining({
      completedIntervals: 0,
      qualityScore: 40
    }))
    expect(store.completeTrainingSession).toHaveBeenCalledWith(expect.objectContaining({
      countsAsCompletion: false
    }))
  })

  it('opens the questionnaire without waiting for a slow stair upload', async () => {
    vi.useFakeTimers()
    studentBackendSync.syncStairSession.mockReturnValue(new Promise(() => {}))

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          StairTrainingPanel: {
            emits: ['start'],
            template: '<button class="start-stair-session" @click="$emit(\'start\')">start</button>'
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(currentUni().redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/^\/pages\/training\/short-questionnaire\?sessionId=stairs-/)
    }))
  })

  it('stops a capture that resolves after the stair page unmounts', async () => {
    const pendingCapture: {
      resolve: ((session: typeof stairSensorCaptureSession) => void) | null
    } = {
      resolve: null
    }
    startStairSensorCapture.mockReturnValue(new Promise(resolve => {
      pendingCapture.resolve = resolve
    }))

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          StairTrainingPanel: {
            emits: ['start'],
            template: '<button class="start-stair-session" @click="$emit(\'start\')">start</button>'
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    wrapper.unmount()
    pendingCapture.resolve?.(stairSensorCaptureSession)
    await flushPromises()

    expect(stairSensorCaptureSession.stop).toHaveBeenCalledWith({
      durationSeconds: 0,
      completedIntervals: 0
    })
    expect(stairSensorCaptureSession.getSnapshot).not.toHaveBeenCalled()
  })

  it('completes the stair flow when sensor shutdown rejects', async () => {
    vi.useFakeTimers()
    stairSensorCaptureSession.stop.mockRejectedValueOnce(new Error('shutdown failed'))

    const StairSessionPage = (await import('../uni-app/pages/training/stair-session.vue')).default
    const wrapper = mount(StairSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          StairTrainingPanel: {
            emits: ['start'],
            template: '<button class="start-stair-session" @click="$emit(\'start\')">start</button>'
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(studentBackendSync.syncStairSession).toHaveBeenCalledTimes(1)
    expect(currentUni().redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/^\/pages\/training\/short-questionnaire\?sessionId=stairs-/)
    }))
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
