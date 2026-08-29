import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let loadPage: ((query?: Record<string, unknown>) => void) | undefined
let showPage: (() => Promise<void>) | undefined
const calls: string[] = []
const setReminderSource = vi.fn()
const resolveReminderReturn = vi.fn(async () => { calls.push('resolve') })
const authorizeReminders = vi.fn()
const loadReminderStatus = vi.fn()
const reminderStatus = { value: 'not_requested' }
const reminderSyncState = { value: 'idle' }

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: typeof loadPage) => { loadPage = callback }),
  onPullDownRefresh: vi.fn(),
  onShow: vi.fn((callback: typeof showPage) => { showPage = callback })
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    resolveReminderReturn,
    retryPendingTrainingSubmissions: vi.fn(async () => ({ attempted: 0, succeeded: 0 })),
    loadTrainingProgress: vi.fn(async () => {
      calls.push('progress')
      return {
        date: '2026-07-16',
        modalities: [
          { modality: 'MARTIAL_ARTS', completed: true },
          { modality: 'HIIT', completed: false },
          { modality: 'STAIRS', completed: false }
        ],
        distinct_daily_count: 1,
        daily_goal_completed: false,
        week: {
          start_date: '2026-07-13',
          end_date: '2026-07-19',
          qualifying_day_count: 1
        }
      }
    }),
    loadStationNotifications: vi.fn(async () => ({ count: 0, notifications: [] }))
  }
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    setReminderSource,
    state: { profile: { name: '小林' } }
  })
}))

vi.mock('../uni-app/composables/useReminderConsent', () => ({
  useReminderConsent: () => ({
    status: reminderStatus,
    syncState: reminderSyncState,
    isWorking: { value: false },
    loadStatus: loadReminderStatus,
    authorize: authorizeReminders
  })
}))

describe('training home reminder return orchestration', () => {
  beforeEach(() => {
    vi.resetModules()
    calls.length = 0
    setReminderSource.mockReset()
    resolveReminderReturn.mockReset().mockImplementation(async () => { calls.push('resolve') })
    authorizeReminders.mockReset()
    loadReminderStatus.mockReset()
    reminderStatus.value = 'not_requested'
    reminderSyncState.value = 'idle'
    loadPage = undefined
    showPage = undefined
  })

  it('resolves the untrusted route before loading fresh training progress', async () => {
    const HomePage = (await import('../uni-app/pages/training/home.vue')).default
    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeHeader: true,
          TrainingHomeQuestPanel: true,
          DailyProgressCard: true,
          ReminderAuthorizationStatus: true,
          TrainingHomeFeatureCard: true,
          TrainingHomeCoachCard: true,
          navigator: true
        }
      }
    })

    loadPage?.({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      date: '2026-07-16'
    })
    await showPage?.()
    await flushPromises()

    expect(calls).toEqual(['resolve', 'progress'])
    expect(setReminderSource).toHaveBeenCalledWith('wechat-reminder')
    expect(wrapper.find('.reminder-card').exists()).toBe(true)
    await wrapper.get('.reminder-card__action').trigger('click')
    expect(authorizeReminders).toHaveBeenCalledTimes(1)
  })

  it('manual entry loads fresh progress without recording a reminder return', async () => {
    const HomePage = (await import('../uni-app/pages/training/home.vue')).default
    mount(HomePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeHeader: true,
          TrainingHomeQuestPanel: true,
          DailyProgressCard: true,
          ReminderAuthorizationStatus: true,
          TrainingHomeFeatureCard: true,
          TrainingHomeCoachCard: true,
          navigator: true
        }
      }
    })

    loadPage?.({})
    await showPage?.()

    expect(calls).toEqual(['progress'])
    expect(setReminderSource).not.toHaveBeenCalled()
  })

  it('keeps the reminder card hidden after authorization is detected', async () => {
    reminderStatus.value = 'accepted'
    const HomePage = (await import('../uni-app/pages/training/home.vue')).default
    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeHeader: true,
          TrainingHomeProgressOverview: true,
          TrainingHomeCoachCard: true,
          QuestionnaireUnlockBanner: true,
          navigator: true
        }
      }
    })

    await showPage?.()
    await flushPromises()

    expect(wrapper.find('.reminder-card').exists()).toBe(false)
  })

  it('waits for a shared return resolution and coalesces concurrent progress refreshes', async () => {
    let completeResolution: (() => void) | undefined
    resolveReminderReturn.mockImplementationOnce(() => {
      calls.push('resolve')
      return new Promise<void>(resolve => { completeResolution = resolve })
    })
    const HomePage = (await import('../uni-app/pages/training/home.vue')).default
    mount(HomePage, {
      global: {
        stubs: {
          UniTrainingPageShell: { template: '<div><slot /></div>' },
          TrainingHomeHeader: true,
          TrainingHomeQuestPanel: true,
          DailyProgressCard: true,
          ReminderAuthorizationStatus: true,
          TrainingHomeFeatureCard: true,
          TrainingHomeCoachCard: true,
          navigator: true
        }
      }
    })

    loadPage?.({
      tracking: 'bc4f8e6e-7418-4a9d-9f89-f6cb7441ca26',
      slot: '18:00',
      date: '2026-07-16'
    })
    const firstShow = showPage?.()
    const secondShow = showPage?.()

    await Promise.resolve()
    expect(calls).toEqual(['resolve'])

    completeResolution?.()
    await Promise.all([firstShow, secondShow])

    expect(calls).toEqual(['resolve', 'progress'])
  })
})
