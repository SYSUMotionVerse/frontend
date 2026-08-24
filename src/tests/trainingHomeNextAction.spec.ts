import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const controls = vi.hoisted(() => ({
  accessState: { value: { level: 'execute', questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline' } },
  continueRequiredQuestionnaire: vi.fn(),
  ensureProtectedStudentAccess: vi.fn(),
  navigateTo: vi.fn(),
  progressState: { value: { status: 'loading' } as Record<string, unknown> },
  refreshNotifications: vi.fn(),
  refreshProgress: vi.fn()
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onShow: vi.fn()
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    setReminderSource: vi.fn(),
    state: { profile: { name: '小林' } }
  })
}))

vi.mock('../uni-app/composables/useTrainingProgress', () => ({
  useTrainingProgress: () => ({
    state: controls.progressState,
    refresh: controls.refreshProgress
  })
}))

vi.mock('../uni-app/composables/useStationNotifications', () => ({
  useStationNotifications: () => ({
    unreadCount: { value: 0 },
    refresh: controls.refreshNotifications,
    openList: vi.fn()
  })
}))

vi.mock('../uni-app/composables/useReminderConsent', () => ({
  useReminderConsent: () => ({
    status: { value: 'not_requested' },
    syncState: { value: 'idle' },
    isWorking: { value: false },
    loadStatus: vi.fn(),
    authorize: vi.fn()
  })
}))

vi.mock('../uni-app/composables/useReminderReturn', () => ({
  useReminderReturn: () => ({
    state: { value: { status: 'idle' } },
    capture: vi.fn(),
    resolvePending: vi.fn()
  })
}))

vi.mock('../uni-app/composables/useNavigationGuard', () => ({
  continueRequiredQuestionnaire: controls.continueRequiredQuestionnaire,
  ensureProtectedStudentAccess: controls.ensureProtectedStudentAccess,
  useProtectedAccessState: () => controls.accessState
}))

type Modality = 'wushu' | 'hiit' | 'stair'

function setProgress(completed: Record<Modality, boolean>) {
  const modalities = [
    { id: 'wushu' as const, label: '武术跟练', completed: completed.wushu },
    { id: 'hiit' as const, label: 'HIIT 跟练', completed: completed.hiit },
    { id: 'stair' as const, label: '楼梯训练', completed: completed.stair }
  ]
  const completedCount = modalities.filter(item => item.completed).length

  controls.progressState.value = {
    status: 'ready',
    progress: {
      date: '2026-08-14',
      dailyCount: completedCount,
      goalCompleted: completedCount === modalities.length,
      modalities,
      week: {
        startDate: '2026-08-10',
        endDate: '2026-08-16',
        qualifyingDayCount: 2
      }
    }
  }
}

async function mountHome() {
  const HomePage = (await import('../uni-app/pages/training/home.vue')).default
  return mount(HomePage, {
    global: {
      stubs: {
        UniTrainingPageShell: { template: '<div><slot /></div>' },
        TrainingHomeHeader: true,
        TrainingHomeProgressOverview: true,
        TrainingHomeCoachCard: true,
        QuestionnaireUnlockBanner: true
      }
    }
  })
}

describe('training home next action', () => {
  beforeEach(() => {
    controls.accessState.value = {
      level: 'execute',
      questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline'
    }
    controls.continueRequiredQuestionnaire.mockReset()
    controls.ensureProtectedStudentAccess.mockReset().mockResolvedValue(true)
    controls.navigateTo.mockReset()
    controls.refreshNotifications.mockReset()
    controls.refreshProgress.mockReset()
    vi.stubGlobal('uni', { navigateTo: controls.navigateTo })
  })

  it('puts the first incomplete visual training first and opens that exact mode', async () => {
    setProgress({ wushu: true, hiit: false, stair: false })
    const wrapper = await mountHome()

    expect(wrapper.get('.home-next-action__eyebrow').text()).toBe('今日下一项')
    expect(wrapper.get('.home-next-action__title').text()).toBe('HIIT 跟练')
    expect(wrapper.get('.home-next-action__button').text()).toContain('开始')

    await wrapper.get('.home-next-action__button').trigger('click')
    await flushPromises()

    expect(controls.ensureProtectedStudentAccess).toHaveBeenCalledWith('execute')
    expect(controls.navigateTo).toHaveBeenCalledWith({
      url: '/subpackages/training/visual-session?modality=hiit'
    })
  }, 15000)

  it('uses the stair session when stairs are the first incomplete training', async () => {
    setProgress({ wushu: true, hiit: true, stair: false })
    const wrapper = await mountHome()

    expect(wrapper.get('.home-next-action__title').text()).toBe('楼梯训练')
    await wrapper.get('.home-next-action__button').trigger('click')
    await flushPromises()

    expect(controls.navigateTo).toHaveBeenCalledWith({
      url: '/pages/training/stair-session'
    })
  })

  it('keeps the primary entry in the questionnaire path for browse-only students', async () => {
    controls.accessState.value = {
      level: 'browse',
      questionnaireUrl: '/pages/access/questionnaire?checkpoint=baseline'
    }
    setProgress({ wushu: false, hiit: false, stair: false })
    const wrapper = await mountHome()

    expect(wrapper.get('.home-next-action__button').text()).toContain('去解锁')
    await wrapper.get('.home-next-action__button').trigger('click')

    expect(controls.continueRequiredQuestionnaire).toHaveBeenCalledTimes(1)
    expect(controls.ensureProtectedStudentAccess).not.toHaveBeenCalled()
    expect(controls.navigateTo).not.toHaveBeenCalled()
  })

  it('replaces the launch action with a compact completion state after all three trainings', async () => {
    setProgress({ wushu: true, hiit: true, stair: true })
    const wrapper = await mountHome()

    expect(wrapper.find('.home-next-action__button').exists()).toBe(false)
    expect(wrapper.text()).toContain('今日训练已完成')
  })
})
