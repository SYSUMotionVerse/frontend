import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const store = {
  completeProfile: vi.fn(),
  setActiveCheckpoint: vi.fn(),
  submitLongQuestionnaire: vi.fn(),
  completeTrainingSession: vi.fn(),
  refreshReminderEligibility: vi.fn(),
  state: {
    profile: {
      avatarUrl: '',
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
  ])
}

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onShow: vi.fn(),
  onBeforeUnmount: vi.fn()
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => store
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync
}))

vi.mock('../uni-app/components/pose/PoseDetectionView.vue', () => ({
  default: defineComponent({
    setup(_props, { expose }) {
      expose({
        startDetect() {},
        startRecord: async () => undefined,
        stopRecord: async () => ''
      })

      return () => h('div', { class: 'pose-detection-view-stub' })
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

    studentBackendSync.bootstrapAccess.mockResolvedValue({
      targetPageUrl: '/pages/training/home'
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

  it('reLaunches from the questionnaire result into the training home page', async () => {
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
      url: '/pages/training/home'
    })
    expect(currentUni().redirectTo).not.toHaveBeenCalledWith({
      url: '/pages/training/home'
    })
  })

  it('syncs visual sessions when the user completes the guided workout', async () => {
    studentBackendSync.syncVisualSession.mockResolvedValue({
      synced: true,
      record: {
        id: 1,
        score: '88.50',
        comment: '动作基本标准，注意细节。',
        status: 'COMPLETED'
      }
    })

    const VisualSessionPage = (await import('../uni-app/pages/training/visual-session.vue')).default
    const wrapper = mount(VisualSessionPage, {
      global: {
        stubs: {
          UniTrainingPageShell: {
            template: '<div><slot /></div>'
          },
          VisualTrainingPanel: {
            template: '<button class="complete-visual-session" @click="$emit(\'complete\')">complete</button>'
          }
        }
      }
    })

    await wrapper.get('.complete-visual-session').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncVisualSession).toHaveBeenCalledWith({
      modality: 'wushu',
      durationSeconds: 30
    })
    expect(store.completeTrainingSession).toHaveBeenCalledWith(
      expect.objectContaining({
        modality: 'wushu',
        qualityScore: 89,
        summary: '动作基本标准，注意细节。'
      })
    )
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/short-questionnaire'
    })
  })

  it('syncs stair sessions using the measured duration before redirecting', async () => {
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
                <button class="complete-stair-session" @click="$emit('complete')">complete</button>
              </div>
            `
          }
        }
      }
    })

    await wrapper.get('.start-stair-session').trigger('click')
    vi.advanceTimersByTime(3000)
    await wrapper.get('.complete-stair-session').trigger('click')
    await flushPromises()

    expect(studentBackendSync.syncStairSession).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: 3
      })
    )
    expect(store.completeTrainingSession).toHaveBeenCalled()
    expect(currentUni().redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/short-questionnaire'
    })
  })
})
