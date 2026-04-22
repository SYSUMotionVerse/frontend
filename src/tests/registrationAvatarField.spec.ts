import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RegistrationAvatarField from '../components/access/RegistrationAvatarField.vue'

describe('registration avatar field', () => {
  it('uses the avatar area itself as the only chooseAvatar trigger', async () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '',
        isWechatMiniProgram: true,
        supportsWechatAvatarSelection: true
      }
    })

    const trigger = wrapper.get('.avatar-field__trigger')

    expect(trigger.attributes('open-type')).toBe('chooseAvatar')
    expect(wrapper.find('.avatar-field__content').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('个人头像')
    expect(wrapper.text()).not.toContain('点击头像区域直接选择微信头像。')

    await trigger.trigger('chooseavatar', {
      detail: {
        avatarUrl: 'wxfile://avatar.png'
      }
    })

    expect(wrapper.emitted('chooseWechatAvatar')).toEqual([
      [
        expect.objectContaining({
          detail: {
            avatarUrl: 'wxfile://avatar.png'
          }
        })
      ]
    ])
  })

  it('does not bind chooseAvatar when the runtime does not support it', () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '游客模式下暂不支持直接选择微信头像。',
        isWechatMiniProgram: true,
        supportsWechatAvatarSelection: false
      }
    })

    const trigger = wrapper.get('.avatar-field__trigger')

    expect(trigger.attributes('open-type')).toBeUndefined()
    expect(trigger.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('游客模式下暂不支持直接选择微信头像。')
  })

  it('keeps the chooser centered with only the avatar circle visible', () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '',
        isWechatMiniProgram: true,
        supportsWechatAvatarSelection: true
      }
    })

    expect(wrapper.find('.avatar-field').exists()).toBe(true)
    expect(wrapper.find('.avatar-field__preview-shell').exists()).toBe(true)
    expect(wrapper.find('.avatar-field__preview-image').exists()).toBe(true)
    expect(wrapper.find('.avatar-field__content').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('添加照片')
  })
})

describe('useRegistrationAvatar', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete (globalThis as { wx?: unknown }).wx
  })

  it('uploads avatar via studentBackendSync.uploadAvatar and stores backend avatar url', async () => {
    const uploadAvatar = vi.fn().mockResolvedValue({
      avatarUrl: 'https://cdn.example.com/backend-avatar.png'
    })

    vi.doMock('../uni-app/api/studentBackend', () => ({
      studentBackendSync: {
        uploadAvatar
      }
    }))

    ;(globalThis as { wx?: unknown }).wx = {
      getAccountInfoSync: () => ({
        miniProgram: {
          appId: 'wx123'
        }
      })
    }

    const { useRegistrationAvatar } = await import('../uni-app/composables/useRegistrationAvatar')
    const avatar = useRegistrationAvatar()

    await avatar.handleWechatAvatarChoice({
      detail: {
        avatarUrl: 'wxfile://avatar.png'
      }
    })

    expect(uploadAvatar).toHaveBeenCalledWith('wxfile://avatar.png', 'wechat')
    expect(avatar.uploadState.value).toBe('success')
    expect(avatar.avatarUrl.value).toBe('https://cdn.example.com/backend-avatar.png')
    expect(avatar.avatarSource.value).toBe('wechat')
    expect(avatar.errorMessage.value).toBe('')
  })
})
