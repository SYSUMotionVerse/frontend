import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const controls = vi.hoisted(() => ({
  loadTrainingSession: vi.fn(),
  onLoad: vi.fn(),
  onShareAppMessage: vi.fn(),
  onShow: vi.fn(),
  refreshReminderEligibility: vi.fn(),
  getSnapshot: vi.fn()
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: controls.onLoad,
  onShareAppMessage: controls.onShareAppMessage,
  onShow: controls.onShow
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    loadTrainingSession: controls.loadTrainingSession
  }
}))

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => ({
    getSnapshot: controls.getSnapshot,
    refreshReminderEligibility: controls.refreshReminderEligibility
  })
}))

describe('training feedback retry', () => {
  beforeEach(() => {
    vi.stubGlobal('uni', {
      reLaunch: vi.fn(),
      switchTab: vi.fn(),
      getStorageSync: vi.fn()
    })
    controls.loadTrainingSession.mockReset()
    controls.onLoad.mockReset()
    controls.onShareAppMessage.mockReset()
    controls.onShow.mockReset()
    controls.refreshReminderEligibility.mockReset()
    controls.getSnapshot.mockReset()
    controls.getSnapshot.mockReturnValue({ sessions: [] })
  })

  it('keeps a failed remote result on screen and reloads it from the primary action', async () => {
    controls.loadTrainingSession
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({
        id: 'remote-session-1',
        modality: 'hiit',
        date: '2026-08-14',
        qualityScore: 86,
        summary: '节奏稳定'
      })

    const FeedbackPage = (await import('../uni-app/pages/training/feedback.vue')).default
    const wrapper = mount(FeedbackPage)
    const loadHandler = controls.onLoad.mock.calls.at(-1)?.[0] as
      | ((query: { sessionId?: string }) => Promise<void> | void)
      | undefined

    expect(loadHandler).toBeDefined()
    await loadHandler?.({ sessionId: 'remote-session-1' })
    await flushPromises()

    expect(wrapper.text()).toContain('训练记录加载失败')
    expect(wrapper.get('.feedback-page__retry-action').text()).toContain('重新加载结果')
    expect(wrapper.get('.feedback-page__secondary-action').text()).toContain('返回首页')

    await wrapper.get('.feedback-page__retry-action').trigger('click')
    await flushPromises()

    expect(controls.loadTrainingSession).toHaveBeenCalledTimes(2)
    expect(controls.loadTrainingSession).toHaveBeenLastCalledWith('remote-session-1')
    expect(wrapper.text()).toContain('质量得分')
    expect(wrapper.text()).toContain('86')
    expect(wrapper.find('.feedback-page__retry-action').exists()).toBe(false)
  })
})
