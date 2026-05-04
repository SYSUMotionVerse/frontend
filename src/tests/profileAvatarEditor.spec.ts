import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudentStore } from '../uni-app/composables/useStudentStore'

type ResolveProfileAvatarSync = (value: {
  avatarUrl: string
  profile: ReturnType<ReturnType<typeof createStudentStore>['getSnapshot']>['profile']
}) => void

describe('useProfileAvatarEditor', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete (globalThis as { wx?: unknown }).wx
    delete (globalThis as { uni?: unknown }).uni
  })

  it('uploads a changed avatar immediately and refreshes the logged-in profile in store', async () => {
    const store = createStudentStore()
    store.completeProfile({
      avatarUrl: 'https://cdn.example.com/old-avatar.png',
      avatarSource: '',
      studentId: '20260001',
      name: 'Lin',
      gender: '女',
      age: 12,
      major: 'Sports Science',
      grade: '一年级',
      heightCm: 160,
      weightKg: 45,
      restingHeartRate: 72,
      completed: true
    })

    const syncProfileAvatarChange = vi.fn().mockResolvedValue({
      avatarUrl: 'https://cdn.example.com/new-avatar.png',
      profile: {
        ...store.getSnapshot().profile,
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        avatarSource: ''
      }
    })

    vi.doMock('../uni-app/composables/useStudentStore', () => ({
      useStudentStore: () => store
    }))

    vi.doMock('../uni-app/api/studentBackend', () => ({
      studentBackendSync: {
        syncProfileAvatarChange
      }
    }))

    ;(globalThis as { wx?: unknown }).wx = {
      getAccountInfoSync: () => ({
        miniProgram: {
          appId: 'wx4305e8964a9093fc'
        }
      })
    }

    const { useProfileAvatarEditor } = await import('../uni-app/composables/useProfileAvatarEditor')
    const editor = useProfileAvatarEditor()

    await editor.handleWechatAvatarChoice({
      detail: {
        avatarUrl: 'wxfile://header-avatar.png'
      }
    })

    expect(syncProfileAvatarChange).toHaveBeenCalledWith(
      'wxfile://header-avatar.png',
      'wechat',
      expect.objectContaining({
        avatarUrl: 'https://cdn.example.com/old-avatar.png',
        name: 'Lin'
      })
    )
    expect(editor.uploadState.value).toBe('success')
    expect(store.getSnapshot().profile.avatarUrl).toBe('https://cdn.example.com/new-avatar.png')
  })

  it('returns immediately from the shared header WeChat avatar callback while the upload continues asynchronously', async () => {
    const store = createStudentStore()
    store.completeProfile({
      avatarUrl: 'https://cdn.example.com/old-avatar.png',
      avatarSource: '',
      studentId: '20260001',
      name: 'Lin',
      gender: '女',
      age: 12,
      major: 'Sports Science',
      grade: '一年级',
      heightCm: 160,
      weightKg: 45,
      restingHeartRate: 72,
      completed: true
    })

    let resolveSync: ResolveProfileAvatarSync | null = null
    const syncProfileAvatarChange = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveSync = resolve
    }))

    vi.doMock('../uni-app/composables/useStudentStore', () => ({
      useStudentStore: () => store
    }))

    vi.doMock('../uni-app/api/studentBackend', () => ({
      studentBackendSync: {
        syncProfileAvatarChange
      }
    }))

    ;(globalThis as { wx?: unknown }).wx = {
      getAccountInfoSync: () => ({
        miniProgram: {
          appId: 'wx4305e8964a9093fc'
        }
      })
    }

    const { useProfileAvatarEditor } = await import('../uni-app/composables/useProfileAvatarEditor')
    const editor = useProfileAvatarEditor()

    const result = editor.handleWechatAvatarChoice({
      detail: {
        avatarUrl: 'wxfile://header-avatar.png'
      }
    })

    expect(result).toBeUndefined()
    expect(syncProfileAvatarChange).toHaveBeenCalledWith(
      'wxfile://header-avatar.png',
      'wechat',
      expect.objectContaining({
        avatarUrl: 'https://cdn.example.com/old-avatar.png'
      })
    )
    expect(editor.uploadState.value).toBe('uploading')

    if (!resolveSync) {
      throw new Error('Expected avatar sync resolver to be captured.')
    }

    const finishSync = resolveSync as ResolveProfileAvatarSync

    finishSync({
      avatarUrl: 'https://cdn.example.com/new-avatar.png',
      profile: {
        ...store.getSnapshot().profile,
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        avatarSource: 'wechat'
      }
    })
    await Promise.resolve()

    expect(editor.uploadState.value).toBe('success')
    expect(store.getSnapshot().profile.avatarUrl).toBe('https://cdn.example.com/new-avatar.png')
  })
})
