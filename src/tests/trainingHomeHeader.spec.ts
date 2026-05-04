import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrainingHomeHeader from '../components/training/TrainingHomeHeader.vue'

function mountHeader(overrides: Partial<InstanceType<typeof TrainingHomeHeader>['$props']> = {}) {
  return mount(TrainingHomeHeader, {
    props: {
      avatarUrl: 'https://cdn.example.com/avatar.png',
      displayName: 'Lin',
      reminderLabel: '今日提醒仍然开启',
      miniTag: "TODAY'S QUEST",
      title: '今天先完成主线任务',
      titlePill: '训练首页',
      variant: 'home',
      avatarUploadState: 'idle',
      avatarErrorMessage: '',
      isWechatMiniProgram: true,
      supportsWechatAvatarSelection: true,
      ...overrides
    }
  })
}

describe('training home header', () => {
  it('uses the shared top-left avatar itself as the direct WeChat chooseAvatar entry', () => {
    const wrapper = mountHeader()

    expect(wrapper.find('.home-header__avatar-trigger').exists()).toBe(true)
    expect(wrapper.get('.home-header__avatar-trigger').attributes('open-type')).toBe('chooseAvatar')
    expect(wrapper.find('.home-header__source-actions').exists()).toBe(false)
  })

  it('forwards chooseavatar directly from the shared avatar trigger without rendering extra source buttons', async () => {
    const wrapper = mountHeader()

    await wrapper.get('.home-header__avatar-trigger').trigger('chooseavatar', {
      detail: {
        avatarUrl: 'wxfile://header-avatar.png'
      }
    })

    expect(wrapper.emitted('chooseWechatAvatar')).toEqual([
      [
        expect.objectContaining({
          detail: {
            avatarUrl: 'wxfile://header-avatar.png'
          }
        })
      ]
    ])
    expect(wrapper.find('.home-header__source-action--wechat').exists()).toBe(false)
    expect(wrapper.find('.home-header__source-action--upload').exists()).toBe(false)
  })
})
