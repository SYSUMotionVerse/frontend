import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const backendProgress = {
  date: '2026-07-16',
  modalities: [
    { modality: 'MARTIAL_ARTS' as const, completed: true },
    { modality: 'HIIT' as const, completed: false },
    { modality: 'STAIRS' as const, completed: false }
  ],
  distinct_daily_count: 1,
  daily_goal_completed: false,
  week: {
    start_date: '2026-07-13',
    end_date: '2026-07-19',
    qualifying_day_count: 2
  }
}

const loadTrainingProgress = vi.fn().mockResolvedValue(backendProgress)
const retryPendingTrainingSubmissions = vi.fn().mockResolvedValue({ attempted: 0, succeeded: 0 })
const loadStationNotifications = vi.fn().mockResolvedValue({ count: 0, notifications: [] })

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onShow: vi.fn((callback: () => unknown) => callback())
}))

vi.mock('../uni-app/api/studentBackend', async importOriginal => {
  const actual = await importOriginal<typeof import('../uni-app/api/studentBackend')>()
  return {
    ...actual,
    studentBackendSync: {
      loadTrainingProgress,
      retryPendingTrainingSubmissions,
      loadStationNotifications,
      markStationNotificationRead: vi.fn()
    }
  }
})

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    setReminderSource: vi.fn(),
    refreshReminderEligibility: vi.fn(),
    state: {
      profile: { name: '小林' },
      dailyAdherence: { validCheckIns: 3, reminderEligible: false },
      weeklyAdherence: { qualifyingDays: 3 }
    }
  })
}))

describe('authoritative training progress', () => {
  beforeEach(() => {
    loadTrainingProgress.mockClear()
    loadTrainingProgress.mockResolvedValue(backendProgress)
    retryPendingTrainingSubmissions.mockClear()
  })

  it('loads the authenticated backend progress contract through the sync boundary', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const getTrainingProgress = vi.fn().mockResolvedValue(backendProgress)
    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      getTrainingProgress
    })

    await expect(sync.loadTrainingProgress()).resolves.toEqual(backendProgress)
    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(getTrainingProgress).toHaveBeenCalledTimes(1)
  })

  it('maps the backend DTO into a camel-case training progress view model', async () => {
    const { mapTrainingProgress } = await import('../uni-app/api/trainingProgressModels')

    expect(mapTrainingProgress(backendProgress)).toEqual({
      date: '2026-07-16',
      dailyCount: 1,
      goalCompleted: false,
      modalities: [
        { id: 'wushu', label: '武术跟练', completed: true },
        { id: 'hiit', label: 'HIIT 跟练', completed: false },
        { id: 'stair', label: '楼梯训练', completed: false }
      ],
      week: {
        startDate: '2026-07-13',
        endDate: '2026-07-19',
        qualifyingDayCount: 2
      }
    })
  })

  it('drops stale ready data when a later progress refresh fails', async () => {
    const { useTrainingProgress } = await import('../uni-app/composables/useTrainingProgress')
    const progress = useTrainingProgress()

    await progress.refresh()
    expect(progress.state.value.status).toBe('ready')

    loadTrainingProgress.mockRejectedValueOnce(new Error('network unavailable'))
    const refresh = progress.refresh()
    expect(progress.state.value).toEqual({ status: 'loading' })
    await refresh

    expect(progress.state.value).toEqual({
      status: 'error',
      message: '今日训练进度暂时无法同步，请稍后重试。'
    })
    expect('progress' in progress.state.value).toBe(false)
  })

  it('renders backend-provided modality state on the training home page', async () => {
    const TrainingHomePage = (await import('../uni-app/pages/training/home.vue')).default
    const wrapper = mount(TrainingHomePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeHeader: true,
          TrainingHomeQuestPanel: true,
          TrainingHomeFeatureCard: true,
          TrainingHomeCoachCard: true
        }
      }
    })

    await flushPromises()

    expect(loadTrainingProgress).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.progress-card').text()).toContain('1/3')
    expect(wrapper.get('.progress-card').text()).toContain('武术跟练')
    expect(wrapper.get('.progress-card').text()).toContain('已完成')
    expect(wrapper.get('.progress-card').text()).toContain('HIIT 跟练')
    expect(wrapper.get('.progress-card').text()).toContain('未完成')
    expect(wrapper.get('.progress-card').text()).toContain('本周达标 2 天')
  })
})
