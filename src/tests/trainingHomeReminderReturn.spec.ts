import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let loadPage: ((query?: Record<string, unknown>) => void) | undefined
let showPage: (() => Promise<void>) | undefined
const calls: string[] = []
const setReminderSource = vi.fn()

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: typeof loadPage) => { loadPage = callback }),
  onShow: vi.fn((callback: typeof showPage) => { showPage = callback })
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    resolveReminderReturn: vi.fn(async () => { calls.push('resolve') }),
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
    state: { profile: { avatarUrl: '', name: '小林' } }
  })
}))

vi.mock('../uni-app/composables/useProfileAvatarEditor', () => ({
  useProfileAvatarEditor: () => ({
    uploadState: 'idle',
    errorMessage: '',
    isWechatMiniProgram: false,
    supportsWechatAvatarSelection: false,
    handleWechatAvatarChoice: vi.fn()
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

describe('training home reminder return orchestration', () => {
  beforeEach(() => {
    vi.resetModules()
    calls.length = 0
    setReminderSource.mockReset()
    loadPage = undefined
    showPage = undefined
  })

  it('resolves the untrusted route before loading fresh three-modality progress', async () => {
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
    await showPage?.()
    await flushPromises()

    expect(calls).toEqual(['resolve', 'progress'])
    expect(setReminderSource).toHaveBeenCalledWith('wechat-reminder')
  })

  it('manual entry still loads fresh progress without recording a reminder return', async () => {
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
})
