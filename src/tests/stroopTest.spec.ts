import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StroopTest from '../components/access/StroopTest.vue'

const api = vi.hoisted(() => ({ startStroop: vi.fn(), submitStroop: vi.fn() }))
vi.mock('../uni-app/api/studentBackend', () => ({ studentBackendSync: api }))
const props = { scaleId: 12, studentId: 'student1', active: true, interruptionKey: 0 }
const stored = new Map<string, unknown>()
const savedRecord = { id: 5, completed_at: '2026-09-20T10:00:00Z', task_result: {
  accuracy_percent: 80, completion_time_ms: 4000, mean_reaction_time_ms: 355
} }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] })
  stored.clear()
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => stored.get(key),
    setStorageSync: (key: string, value: unknown) => stored.set(key, value),
    removeStorageSync: (key: string) => stored.delete(key)
  })
  api.startStroop.mockReset().mockResolvedValue({ session_id: 'session-1', screening_passed: true,
    stimuli: Array.from({ length: 10 }, () => ({ word: 'GREEN', ink_color: 'RED', congruent: false })) })
  api.submitStroop.mockReset().mockResolvedValue({ record: savedRecord })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function ready(wrapper: ReturnType<typeof mount>) {
  for (let i = 0; i < 4; i++) await wrapper.findAll('.stroop__buttons button')[i]!.trigger('click')
  await flushPromises()
  await wrapper.get('.stroop__primary').trigger('click')
  await vi.advanceTimersByTimeAsync(50)
}
async function finish(wrapper: ReturnType<typeof mount>) {
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(300)
    await wrapper.findAll('.stroop__buttons button')[0]!.trigger('click')
    await vi.advanceTimersByTimeAsync(50)
  }
  await flushPromises()
}

describe('Stroop test', () => {
  it('shows the neutral task name and the configured full instruction', () => {
    const wrapper = mount(StroopTest, {
      props: {
        ...props,
        instructions: '接下来是一项简短的认知任务。请忽略文字本身的含义，只判断文字实际显示的颜色。'
      }
    })

    expect(wrapper.get('.stroop__title').text()).toBe('颜色判断任务')
    expect(wrapper.text()).toContain('请忽略文字本身的含义，只判断文字实际显示的颜色')
    expect(wrapper.text()).not.toContain('Stroop 色词测试')
    wrapper.unmount()
  })

  it('screens four colors, records ten timed answers, and completes only after a saved result', async () => {
    const wrapper = mount(StroopTest, { props })
    await ready(wrapper)
    expect(api.startStroop).toHaveBeenCalledWith(12, ['RED', 'GREEN', 'BLUE', 'YELLOW'])
    expect(wrapper.get('.stroop__stimulus').text()).toBe('GREEN')
    await finish(wrapper)
    const payload = api.submitStroop.mock.calls[0]![1]
    expect(payload.trials).toHaveLength(10)
    expect(payload.trials.every((t: { reaction_time_ms: number }) => t.reaction_time_ms >= 300)).toBe(true)
    expect(payload.completion_time_ms).toBeGreaterThanOrEqual(3000)
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.text()).toContain('4.00 秒')
    expect(wrapper.text()).not.toContain('分级')
    expect(wrapper.emitted('completed')).toBeUndefined()
    expect(stored.size).toBe(0)
    await wrapper.get('.stroop__primary').trigger('click')
    expect(wrapper.emitted('completed')?.[0]).toEqual([savedRecord])
    wrapper.unmount()
  })

  it('restarts incomplete trials on background interruption without submitting', async () => {
    const wrapper = mount(StroopTest, { props })
    await ready(wrapper)
    await wrapper.setProps({ interruptionKey: 1 })
    expect(wrapper.text()).toContain('已中断')
    expect(wrapper.text()).toContain('先做辨色检查')
    expect(api.submitStroop).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps a failed upload across remounts and retries exactly the same payload', async () => {
    api.submitStroop.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(StroopTest, { props })
    await ready(wrapper)
    await finish(wrapper)
    const payload = api.submitStroop.mock.calls[0]![1]
    expect(wrapper.text()).toContain('尚未上传成功')
    expect(stored.size).toBe(1)
    wrapper.unmount()
    const other = mount(StroopTest, { props: { ...props, studentId: 'other' } })
    expect(other.text()).toContain('先做辨色检查')
    other.unmount()
    const restored = mount(StroopTest, { props })
    expect(restored.text()).toContain('成绩等待上传')
    await restored.get('.stroop__primary').trigger('click')
    await flushPromises()
    expect(api.submitStroop.mock.calls[1]![1]).toEqual(payload)
    expect(restored.text()).toContain('成绩已保存')
    restored.unmount()
  })

  it('does not start formal trials after failed screening', async () => {
    api.startStroop.mockResolvedValue({ screening_passed: false, stimuli: [] })
    const wrapper = mount(StroopTest, { props })
    for (let i = 0; i < 4; i++) await wrapper.findAll('.stroop__buttons button')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('辨色未全部正确')
    expect(wrapper.find('.stroop__stimulus').exists()).toBe(false)
    wrapper.unmount()
  })
})
