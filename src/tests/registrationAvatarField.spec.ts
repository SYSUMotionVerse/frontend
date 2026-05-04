import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RegistrationAvatarField from '../components/access/RegistrationAvatarField.vue'

describe('registration avatar field', () => {
  it('opens a source chooser from the avatar area and can trigger WeChat avatar selection', async () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '',
        isSourceChooserVisible: false,
        localAvatarChooserMessage: '请选择微信头像或从相册上传。',
        isWechatMiniProgram: true,
        supportsWechatAvatarSelection: true
      }
    })

    const trigger = wrapper.get('.avatar-field__trigger')

    expect(trigger.attributes('open-type')).toBeUndefined()
    expect(wrapper.find('.avatar-field__source-actions').exists()).toBe(false)

    await trigger.trigger('click')

    expect(wrapper.emitted('openSourceChooser')).toEqual([[]])

    await wrapper.setProps({
      isSourceChooserVisible: true
    })

    expect(wrapper.find('.avatar-field__source-actions').exists()).toBe(true)

    const wechatAction = wrapper.get('.avatar-field__source-action--wechat')
    expect(wechatAction.attributes('open-type')).toBe('chooseAvatar')

    await wechatAction.trigger('chooseavatar', {
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

  it('emits local upload when the user chooses image upload from the avatar source chooser', async () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '',
        isSourceChooserVisible: true,
        localAvatarChooserMessage: '请选择微信头像或从相册上传。',
        isWechatMiniProgram: true,
        supportsWechatAvatarSelection: true
      }
    })

    await wrapper.get('.avatar-field__source-action--upload').trigger('click')

    expect(wrapper.emitted('chooseLocalAvatar')).toEqual([[]])
  })

  it('does not bind chooseAvatar when the runtime does not support it', () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '游客模式下暂不支持直接选择微信头像。',
        isSourceChooserVisible: false,
        localAvatarChooserMessage: '请选择微信头像或从相册上传。',
        isWechatMiniProgram: true,
        supportsWechatAvatarSelection: false
      }
    })

    const trigger = wrapper.get('.avatar-field__trigger')

    expect(trigger.attributes('open-type')).toBeUndefined()
    expect(trigger.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('游客模式下暂不支持直接选择微信头像。')
  })

  it('keeps the chooser centered with only the avatar circle visible', () => {
    const wrapper = mount(RegistrationAvatarField, {
      props: {
        avatarUrl: '',
        uploadState: 'idle',
        errorMessage: '',
        isSourceChooserVisible: false,
        localAvatarChooserMessage: '请选择微信头像或从相册上传。',
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
    delete (globalThis as { uni?: unknown }).uni
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

  it('returns immediately from the WeChat avatar callback while the upload continues asynchronously', async () => {
    let resolveUpload: ((value: { avatarUrl: string }) => void) | null = null
    const uploadAvatar = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveUpload = resolve
    }))

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

    const result = avatar.handleWechatAvatarChoice({
      detail: {
        avatarUrl: 'wxfile://avatar.png'
      }
    })

    expect(result).toBeUndefined()
    expect(uploadAvatar).toHaveBeenCalledWith('wxfile://avatar.png', 'wechat')
    expect(avatar.uploadState.value).toBe('uploading')

    if (!resolveUpload) {
      throw new Error('Expected upload resolver to be captured.')
    }

    const finishUpload = resolveUpload as (value: { avatarUrl: string }) => void

    finishUpload({
      avatarUrl: 'https://cdn.example.com/backend-avatar.png'
    })
    await Promise.resolve()

    expect(avatar.uploadState.value).toBe('success')
    expect(avatar.avatarUrl.value).toBe('https://cdn.example.com/backend-avatar.png')
  })

  it('uploads avatar through local image selection when the user chooses upload', async () => {
    const uploadAvatar = vi.fn().mockResolvedValue({
      avatarUrl: 'https://cdn.example.com/local-upload-avatar.png'
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

    ;(globalThis as { uni?: unknown }).uni = {
      chooseImage: vi.fn((options: UniApp.ChooseImageOptions) => {
        options.success?.({
          errMsg: 'chooseImage:ok',
          tempFilePaths: ['wxfile://album-avatar.png'],
          tempFiles: []
        })
      })
    }

    const { useRegistrationAvatar } = await import('../uni-app/composables/useRegistrationAvatar')
    const avatar = useRegistrationAvatar()

    await avatar.handleLocalAvatarChoice()

    expect(uploadAvatar).toHaveBeenCalledWith('wxfile://album-avatar.png', 'album')
    expect(avatar.uploadState.value).toBe('success')
    expect(avatar.avatarUrl.value).toBe('https://cdn.example.com/local-upload-avatar.png')
    expect(avatar.avatarSource.value).toBe('album')
  })
})
