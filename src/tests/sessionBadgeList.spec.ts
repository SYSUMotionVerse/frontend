import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import SessionBadgeList from '../components/growth/SessionBadgeList.vue'

describe('SessionBadgeList', () => {
  it('uses compact pink half-width cards without borders, score charts or modality copy', () => {
    const wrapper = mount(SessionBadgeList, {
      props: {
        badges: [{
          id: 'badge-1',
          level: 'gold',
          title: '动作稳定星',
          description: '动作控制和完成度都很稳定。',
          scoreLabel: '88 分',
          sessionDate: '2026-09-02',
          modalityLabel: '传统体育养生训练',
          svgName: 'stable-star',
          shareTitle: '分享徽章',
          sharePath: '/pages/access/startup',
          earnedCount: 3
        }]
      },
      global: {
        stubs: {
          UniIcons: { template: '<i class="icon" />' }
        }
      }
    })

    expect(wrapper.find('.session-badge__icon').exists()).toBe(true)
    expect(wrapper.find('.session-badge__chart').exists()).toBe(false)
    expect(wrapper.text()).toContain('动作稳定星')
    expect(wrapper.text()).toContain('累计 3 次')
    expect(wrapper.text()).toContain('动作控制和完成度都很稳定。')
    expect(wrapper.text()).not.toContain('传统体育养生训练')
    expect(wrapper.text()).not.toContain('88 分')
    expect(wrapper.get('.session-badge__share').text()).toBe('')
    expect(wrapper.get('.session-badge__share').attributes('aria-label')).toBe('分享徽章')

    const source = readFileSync(resolve('src/components/growth/SessionBadgeList.vue'), 'utf8')
    expect(source).toMatch(/\.session-badge\s*\{[\s\S]*flex:\s*0 0 318rpx;/)
    expect(source).toMatch(/\.session-badge\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*#fcf7f0;/)
    expect(source).toMatch(/\.session-badge__share\s*\{[\s\S]*background:\s*transparent;/)
  })
})
