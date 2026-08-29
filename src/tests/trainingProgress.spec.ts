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
  onPullDownRefresh: vi.fn(),
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

  it('reuses fresh training progress rather than requesting again on a home return', async () => {
    const { useTrainingProgress } = await import('../uni-app/composables/useTrainingProgress')
    const progress = useTrainingProgress()
    progress.invalidate()
    loadTrainingProgress.mockClear()

    await progress.refresh()
    const readyState = progress.state.value
    await progress.refresh()

    expect(loadTrainingProgress).toHaveBeenCalledTimes(1)
    expect(progress.state.value).toBe(readyState)
  })

  it('drops stale ready data when a later progress refresh fails', async () => {
    const { useTrainingProgress } = await import('../uni-app/composables/useTrainingProgress')
    const progress = useTrainingProgress()

    await progress.refresh()
    expect(progress.state.value.status).toBe('ready')

    loadTrainingProgress.mockRejectedValueOnce(new Error('network unavailable'))
    const refresh = progress.refresh({ force: true })
    expect(progress.state.value.status).toBe('ready')
    await refresh

    expect(progress.state.value).toEqual({
      status: 'error',
      message: '今日训练进度暂时无法同步，请稍后重试。'
    })
    expect('progress' in progress.state.value).toBe(false)
  })

  it('puts the first backend-confirmed pending mode first and marks every playground row', async () => {
    const TrainingSelectPage = (await import('../uni-app/pages/training/select.vue')).default
    const { useTrainingProgress } = await import('../uni-app/composables/useTrainingProgress')
    useTrainingProgress().invalidate()
    const wrapper = mount(TrainingSelectPage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeHeader: true
        }
      }
    })

    await flushPromises()

    expect(loadTrainingProgress).toHaveBeenCalledTimes(1)
    const launchRows = wrapper.findAll('.select-page__launch-action')

    expect(launchRows).toHaveLength(3)
    expect(launchRows[0].text()).toContain('自重抗阻')
    expect(launchRows[0].text()).toContain('推荐')
    expect(launchRows[1].text()).toContain('武术')
    expect(launchRows[1].text()).not.toContain('Wushu')
    expect(launchRows[1].text()).toContain('已完成')
    expect(launchRows[2].text()).toContain('跑楼梯')
    expect(launchRows[2].text()).not.toContain('Stairs')
    expect(launchRows[2].text()).toContain('待完成')
  }, 15000)
})
