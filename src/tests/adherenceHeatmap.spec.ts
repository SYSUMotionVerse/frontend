import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import AdherenceHeatmap from '../components/growth/AdherenceHeatmap.vue'

describe('AdherenceHeatmap', () => {
  it('maps daily training counts to four GitHub-style intensity levels', () => {
    const wrapper = mount(AdherenceHeatmap, {
      props: {
        days: [
          { date: '2026-07-01', completedSessions: 0, status: 'none' },
          { date: '2026-07-02', completedSessions: 1, status: 'partial' },
          { date: '2026-07-03', completedSessions: 2, status: 'partial' },
          { date: '2026-07-04', completedSessions: 4, status: 'met-goal' }
        ]
      }
    })

    const cells = wrapper.findAll('.adherence-cell:not(.adherence-cell--empty)')

    expect(cells[0].classes()).toContain('adherence-cell--level-0')
    expect(cells[1].classes()).toContain('adherence-cell--level-1')
    expect(cells[2].classes()).toContain('adherence-cell--level-2')
    expect(cells[3].classes()).toContain('adherence-cell--level-3')
  })

  it('shows a four-level legend from fewer to more daily sessions', () => {
    const wrapper = mount(AdherenceHeatmap, {
      props: { days: [] }
    })

    expect(wrapper.findAll('.adherence-legend__swatch')).toHaveLength(4)
    expect(wrapper.find('.adherence-legend').text()).toBe('少多')
  })

  it('lays weekdays and weeks horizontally while keeping the legend vertical', () => {
    const wrapper = mount(AdherenceHeatmap, {
      props: {
        days: [
          { date: '2026-08-24', completedSessions: 1, status: 'partial' },
          { date: '2026-08-25', completedSessions: 0, status: 'none' }
        ]
      }
    })

    expect(wrapper.find('.adherence-weekdays').text()).toBe('一二三四五六日')
    expect(wrapper.findAll('.adherence-week').at(0)?.findAll('.adherence-cell')).toHaveLength(7)

    const source = wrapper.html()
    expect(source).toContain('adherence-chart')
    expect(source).toContain('adherence-legend')

    const componentSource = readFileSync(resolve('src/components/growth/AdherenceHeatmap.vue'), 'utf8')
    expect(componentSource).toContain('gap: 88rpx;')
    expect(componentSource).toContain('background: #eef7ff;')
    expect(componentSource).not.toContain('background: #f1f5f9;')
  })
})
