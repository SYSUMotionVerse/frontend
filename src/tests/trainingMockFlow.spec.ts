import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const controls = vi.hoisted(() => ({
  onLoadHandlers: [] as Array<(query?: Record<string, unknown>) => void>,
  redirectTo: vi.fn(),
  syncShortQuestionnaire: vi.fn(),
  retryPendingShortQuestionnaires: vi.fn(),
  loadTrainingSession: vi.fn(),
  loadGrowthHistory: vi.fn(),
  loadVisualScoreTrend: vi.fn(),
  submitShortQuestionnaireForSession: vi.fn(),
  refreshReminderEligibility: vi.fn(),
  getSnapshot: vi.fn()
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (handler: (query?: Record<string, unknown>) => void) => {
    controls.onLoadHandlers.push(handler)
  },
  onShareAppMessage: vi.fn(),
  onShow: vi.fn()
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    syncShortQuestionnaire: controls.syncShortQuestionnaire,
    retryPendingShortQuestionnaires: controls.retryPendingShortQuestionnaires,
    loadTrainingSession: controls.loadTrainingSession,
    loadGrowthHistory: controls.loadGrowthHistory,
    loadVisualScoreTrend: controls.loadVisualScoreTrend
  }
}))

vi.mock('../uni-app/api/reportBackendSyncError', () => ({
  reportBackendSyncError: vi.fn()
}))

vi.mock('../uni-app/composables/useSubmissionHandoff', () => ({
  useSubmissionHandoff: () => ({ waitForConfirmation: vi.fn().mockResolvedValue(true) })
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    getSnapshot: controls.getSnapshot,
    submitShortQuestionnaireForSession: controls.submitShortQuestionnaireForSession,
    refreshReminderEligibility: controls.refreshReminderEligibility,
    state: { profile: { gender: '男' } }
  })
}))

describe('training mock page flow', () => {
  beforeEach(() => {
    controls.onLoadHandlers.length = 0
    controls.redirectTo.mockReset().mockResolvedValue(undefined)
    controls.syncShortQuestionnaire.mockReset()
    controls.retryPendingShortQuestionnaires.mockReset().mockResolvedValue(undefined)
    controls.loadTrainingSession.mockReset()
    controls.loadGrowthHistory.mockReset()
    controls.loadVisualScoreTrend.mockReset()
    controls.submitShortQuestionnaireForSession.mockReset()
    controls.refreshReminderEligibility.mockReset()
    controls.getSnapshot.mockReset().mockReturnValue({ sessions: [] })
    vi.stubEnv('VITE_TRAINING_MOCK_ENABLED', 'true')
    vi.stubGlobal('uni', {
      redirectTo: controls.redirectTo,
      switchTab: vi.fn(),
      createSelectorQuery: vi.fn()
    })
  })

  it('stores a mock questionnaire locally and preserves mock context in navigation', async () => {
    controls.getSnapshot.mockReturnValue({
      sessions: [{ id: 'mock-flow-1' }]
    })
    const Page = (await import('../uni-app/pages/training/short-questionnaire.vue')).default
    const wrapper = mount(Page, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<section><slot /></section>' },
          ShortQuestionnaireForm: {
            template: '<button class="submit" @click="$emit(\'submit\', { feelingScale: 4, feltArousalScale: 5 })">提交</button>'
          }
        }
      }
    })
    controls.onLoadHandlers.at(-1)?.({
      sessionId: 'mock-flow-1',
      mock: '1',
      modality: 'hiit'
    })

    await wrapper.get('.submit').trigger('click')
    await flushPromises()

    expect(controls.submitShortQuestionnaireForSession).toHaveBeenCalledWith(
      'mock-flow-1',
      { feelingScale: 4, feltArousalScale: 5 }
    )
    expect(controls.syncShortQuestionnaire).not.toHaveBeenCalled()
    expect(controls.redirectTo).toHaveBeenCalledWith({
      url: '/pages/training/feedback?sessionId=mock-flow-1&mock=1&modality=hiit'
    })
  })

  it('renders feedback fixtures without loading a training result from the backend', async () => {
    const Page = (await import('../uni-app/pages/training/feedback.vue')).default
    const wrapper = mount(Page, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<section><slot /></section>' },
          UniPageHeading: {
            props: ['eyebrow', 'title', 'description'],
            template: '<header>{{ eyebrow }} {{ title }} {{ description }}</header>'
          },
          TrainingFeedbackBodyMap: {
            props: ['gender'],
            template: '<div class="mock-body-map-gender">{{ gender }}</div>'
          },
          TrainingFeedbackTrendChart: true,
          TrainingFeedbackActionCard: true
        }
      }
    })
    controls.onLoadHandlers.at(-1)?.({
      sessionId: 'mock-flow-2',
      mock: '1',
      modality: 'hiit'
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Mock')
    expect(wrapper.text()).toContain('训练已记录')
    expect(wrapper.text()).toContain('结果已经为你保存')
    expect(wrapper.text()).toContain('自重抗阻训练完成')
    expect(wrapper.text()).toContain('86')
    expect(wrapper.text()).toContain('整体节奏稳定')
    expect(wrapper.get('.mock-body-map-gender').text()).toBe('女')
    expect(controls.loadTrainingSession).not.toHaveBeenCalled()
    expect(controls.loadGrowthHistory).not.toHaveBeenCalled()
    expect(controls.loadVisualScoreTrend).not.toHaveBeenCalled()
  })
})
