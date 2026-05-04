import { computed, shallowRef } from 'vue'
import type { StudentProfile } from '../../types/student'
import { studentBackendSync } from '../api/studentBackend'
import { useStudentStore } from './useStudentStore'

export type AvatarUploadState = 'idle' | 'uploading' | 'success' | 'error'
export type AvatarSource = StudentProfile['avatarSource']

type ChooseAvatarEvent = {
  detail?: {
    avatarUrl?: string
  }
}

const UNSUPPORTED_WECHAT_AVATAR_MESSAGE = '游客模式下暂不支持直接选择微信头像。'
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

export function useProfileAvatarEditor() {
  const store = useStudentStore()
  const uploadState = shallowRef<AvatarUploadState>('idle')
  const errorMessage = shallowRef('')
  const isWechatMiniProgram = shallowRef(
    typeof globalThis !== 'undefined' && 'wx' in globalThis
  )
  const supportsWechatAvatarSelection = shallowRef(resolveSupportsWechatAvatarSelection())

  if (isWechatMiniProgram.value && !supportsWechatAvatarSelection.value) {
    errorMessage.value = UNSUPPORTED_WECHAT_AVATAR_MESSAGE
  }

  const avatarUrl = computed(() => store.state.profile.avatarUrl)
  const avatarSource = computed(() => store.state.profile.avatarSource)

  async function persistAvatar(filePath: string, source: Exclude<AvatarSource, ''>) {
    uploadState.value = 'uploading'
    errorMessage.value = ''

    try {
      const result = await studentBackendSync.syncProfileAvatarChange(
        filePath,
        source,
        store.getSnapshot().profile
      )

      store.updateProfileAvatar(result.profile)
      uploadState.value = 'success'
    } catch (error) {
      uploadState.value = 'error'
      errorMessage.value = resolveUploadErrorMessage(error)
    }
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

  return {
    avatarUrl,
    avatarSource,
    uploadState,
    errorMessage,
    isWechatMiniProgram,
    supportsWechatAvatarSelection,
    handleWechatAvatarChoice
  }
}
