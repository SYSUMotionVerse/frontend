import { shallowRef } from 'vue'
import type { StudentProfile } from '../../types/student'
import { studentBackendSync } from '../api/studentBackend'

export type AvatarSource = StudentProfile['avatarSource']
export type AvatarUploadState = 'idle' | 'uploading' | 'success' | 'error'

type ChooseAvatarEvent = {
  detail?: {
    avatarUrl?: string
  }
}

type UploadAvatarResult = {
  avatarUrl: string
}
const UNSUPPORTED_WECHAT_AVATAR_MESSAGE = '游客模式下暂不支持直接选择微信头像。'
const LOCAL_AVATAR_CHOOSER_MESSAGE = '请选择微信头像或从相册上传。'

function resolveSupportsWechatAvatarSelection() {
  if (typeof globalThis === 'undefined' || !('wx' in globalThis)) {
    return false
  }

  const runtime = globalThis as typeof globalThis & {
    wx?: {
      getAccountInfoSync?: () => {
        miniProgram?: {
          appId?: string
        }
      }
    }
  }

  const appId = runtime.wx?.getAccountInfoSync?.()?.miniProgram?.appId?.trim()

  if (!appId) {
    return true
  }

  return appId !== 'touristappid'
}

function resolveUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Avatar upload failed. Please try again.'
}

async function chooseLocalAvatarFile() {
  if (typeof uni === 'undefined') {
    throw new Error('Local image selection is not available in this environment.')
  }

  return new Promise<string>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success(result) {
        const filePath = result.tempFilePaths?.[0]?.trim()
        if (!filePath) {
          reject(new Error('Image selection did not return a file.'))
          return
        }

        resolve(filePath)
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

export function useRegistrationAvatar() {
  const avatarUrl = shallowRef('')
  const avatarSource = shallowRef<AvatarSource>('')
  const uploadState = shallowRef<AvatarUploadState>('idle')
  const errorMessage = shallowRef('')
  const isSourceChooserVisible = shallowRef(false)
  const isWechatMiniProgram = shallowRef(
    typeof globalThis !== 'undefined' && 'wx' in globalThis
  )
  const supportsWechatAvatarSelection = shallowRef(resolveSupportsWechatAvatarSelection())

  if (isWechatMiniProgram.value && !supportsWechatAvatarSelection.value) {
    errorMessage.value = UNSUPPORTED_WECHAT_AVATAR_MESSAGE
  }

  async function persistAvatar(filePath: string, source: Exclude<AvatarSource, ''>) {
    uploadState.value = 'uploading'
    errorMessage.value = ''
    isSourceChooserVisible.value = false

    try {
      const result = await studentBackendSync.uploadAvatar(filePath, source)

      avatarUrl.value = result.avatarUrl
      avatarSource.value = source
      uploadState.value = 'success'
    } catch (error) {
      avatarUrl.value = ''
      avatarSource.value = ''
      uploadState.value = 'error'
      errorMessage.value = resolveUploadErrorMessage(error)
    }
  }

  function openSourceChooser() {
    if (uploadState.value === 'uploading') {
      return
    }

    errorMessage.value = supportsWechatAvatarSelection.value ? '' : UNSUPPORTED_WECHAT_AVATAR_MESSAGE
    isSourceChooserVisible.value = true
  }

  function closeSourceChooser() {
    isSourceChooserVisible.value = false
  }

  function handleWechatAvatarChoice(event: ChooseAvatarEvent) {
    const filePath = event.detail?.avatarUrl?.trim()

    if (!filePath) {
      uploadState.value = 'error'
      errorMessage.value = 'WeChat avatar selection did not return an image.'
      return
    }

    void persistAvatar(filePath, 'wechat')
  }

  async function handleLocalAvatarChoice() {
    try {
      const filePath = await chooseLocalAvatarFile()
      await persistAvatar(filePath, 'album')
    } catch (error) {
      uploadState.value = 'error'
      errorMessage.value = resolveUploadErrorMessage(error)
    }
  }

  return {
    avatarUrl,
    avatarSource,
    uploadState,
    errorMessage,
    isSourceChooserVisible,
    localAvatarChooserMessage: LOCAL_AVATAR_CHOOSER_MESSAGE,
    isWechatMiniProgram,
    supportsWechatAvatarSelection,
    openSourceChooser,
    closeSourceChooser,
    handleWechatAvatarChoice,
    handleLocalAvatarChoice
  }
}
