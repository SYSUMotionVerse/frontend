import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TrainingWeekHistory from '../components/growth/TrainingWeekHistory.vue'

describe('TrainingWeekHistory', () => {
  it('selects today in the current week and Monday in every other week', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 2, 12))

    const wrapper = mount(TrainingWeekHistory, {
      props: {
        sessions: [
          { id: 'previous-monday', modality: 'stair', date: '2026-08-24', summary: '上周一训练', qualityScore: 79 },
          { id: 'monday', modality: 'wushu', date: '2026-08-31', summary: '周一训练', qualityScore: 88 },
          { id: 'tuesday', modality: 'hiit', date: '2026-09-01', summary: '周二训练', qualityScore: 82 },
          { id: 'today', modality: 'hiit', date: '2026-09-02', summary: '当天训练', qualityScore: 90 }
        ]
      },
      global: {
        stubs: {
          UniIcons: { template: '<i />' }
        }
      }
    })

    expect(wrapper.findAll('.week-history__day')).toHaveLength(7)
    expect(wrapper.text()).toContain('8/31 – 9/6')
    expect(wrapper.findAll('.week-history__day')[2].classes()).toContain('week-history__day--selected')
    expect(wrapper.text()).toContain('当天训练')
    expect(wrapper.text()).not.toContain('周一训练')
    expect(wrapper.text()).not.toContain('周二训练')

    await wrapper.findAll('.week-history__day')[1].trigger('click')
    expect(wrapper.text()).toContain('周二训练')
    expect(wrapper.text()).not.toContain('周一训练')

    await wrapper.get('[aria-label="上一周"]').trigger('click')
    expect(wrapper.text()).toContain('8/24 – 8/30')
    expect(wrapper.findAll('.week-history__day')[0].classes()).toContain('week-history__day--selected')
    expect(wrapper.text()).toContain('上周一训练')

    await wrapper.get('[aria-label="下一周"]').trigger('click')
    expect(wrapper.findAll('.week-history__day')[2].classes()).toContain('week-history__day--selected')
    expect(wrapper.text()).toContain('当天训练')

    vi.useRealTimers()
  })
})
