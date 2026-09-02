import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrainingHistoryList from '../components/growth/TrainingHistoryList.vue'

const sessions = Array.from({ length: 7 }, (_, index) => ({
  id: `session-${index}`,
  modality: (index % 3 === 0 ? 'wushu' : index % 3 === 1 ? 'hiit' : 'stair') as 'wushu' | 'hiit' | 'stair',
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  durationSeconds: 75 + index,
  summary: `第 ${index + 1} 次训练`,
  qualityScore: 80 + index
}))

describe('TrainingHistoryList', () => {
  it('localizes modalities and reveals training history three rows at a time', async () => {
    const wrapper = mount(TrainingHistoryList, {
      props: { sessions },
      global: {
        stubs: {
          UniIcons: { template: '<i />' }
        }
      }
    })

    expect(wrapper.findAll('.history-item')).toHaveLength(3)
    expect(wrapper.text()).toContain('武术')
    expect(wrapper.text()).toContain('自重抗阻')
    expect(wrapper.text()).toContain('跑楼梯')
    expect(wrapper.text()).toContain('训练时长')

    await wrapper.get('.history__more').trigger('click')
    expect(wrapper.findAll('.history-item')).toHaveLength(6)

    await wrapper.get('.history__more').trigger('click')
    expect(wrapper.findAll('.history-item')).toHaveLength(7)
    expect(wrapper.find('.history__more').exists()).toBe(false)
  })
})
