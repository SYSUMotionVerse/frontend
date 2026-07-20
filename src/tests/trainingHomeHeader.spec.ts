import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrainingHomeHeader from '../components/training/TrainingHomeHeader.vue'

function mountHeader(overrides: Partial<InstanceType<typeof TrainingHomeHeader>['$props']> = {}) {
  return mount(TrainingHomeHeader, {
    props: {
      displayName: 'Lin',
      reminderLabel: '今日提醒仍然开启',
      miniTag: "TODAY'S QUEST",
      title: '今天先完成主线任务',
      titlePill: '训练首页',
      variant: 'home',
      ...overrides
    }
  })
}

describe('training home header', () => {
  it('renders the built-in default avatar as a non-interactive icon', () => {
    const wrapper = mountHeader()

    expect(wrapper.find('.home-header__avatar-trigger').exists()).toBe(false)
    expect(wrapper.get('.home-header__avatar-shell').attributes('aria-label')).toBe('默认用户头像')
    expect(wrapper.get('.home-header__avatar').attributes('src')).toContain('data:image/svg+xml')
    expect(wrapper.emitted('chooseWechatAvatar')).toBeUndefined()
  })
})
