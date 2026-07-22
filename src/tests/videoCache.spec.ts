import { describe, expect, it, vi } from 'vitest'
import { createVideoCache } from '../uni-app/platform/videoCache'

function createPlatform() {
  const storage = new Map<string, unknown>()
  const files = new Map<string, number>()
  let sequence = 0
  const platform = {
    getStorageSync: vi.fn((key: string) => storage.get(key)),
    setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
    downloadFile: vi.fn(({ success }: any) => {
      sequence += 1
      success({ tempFilePath: `/tmp/video-${sequence}.mp4`, statusCode: 200 })
    }),
    saveFile: vi.fn(({ success }: any) => {
      const filePath = `/saved/video-${sequence}.mp4`
      files.set(filePath, 20)
      success({ savedFilePath: filePath })
    }),
    getSavedFileInfo: vi.fn(({ filePath, success, fail }: any) => {
      const size = files.get(filePath)
      if (size === undefined) fail({ errMsg: 'missing' })
      else success({ size })
    }),
    removeSavedFile: vi.fn(({ filePath, complete }: any) => {
      files.delete(filePath)
      complete()
    })
  }
  return { files, platform }
}

describe('training video cache', () => {
  it('downloads once and reuses the persistent local path', async () => {
    const { platform } = createPlatform()
    const cache = createVideoCache({ platform })
    const url = 'https://cdn.example.com/action-1.mp4'

    const first = await cache.prefetch(url)
    const second = await cache.prefetch(url)

    expect(first).toBe('/saved/video-1.mp4')
    expect(second).toBe(first)
    expect(platform.downloadFile).toHaveBeenCalledTimes(1)

    const nextAppLaunchCache = createVideoCache({ platform })
    expect(await nextAppLaunchCache.get(url)).toBe(first)
    expect(platform.downloadFile).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent downloads for the same CDN URL', async () => {
    const { platform } = createPlatform()
    const cache = createVideoCache({ platform })
    const url = 'https://cdn.example.com/action-1.mp4'

    const [first, second] = await Promise.all([
      cache.prefetch(url),
      cache.prefetch(url)
    ])

    expect(first).toBe(second)
    expect(platform.downloadFile).toHaveBeenCalledTimes(1)
  })

  it('keeps a rolling LRU window and deletes the oldest saved file', async () => {
    const { files, platform } = createPlatform()
    let timestamp = 0
    const cache = createVideoCache({
      platform,
      maxEntries: 2,
      maxBytes: 100,
      now: () => ++timestamp
    })

    await cache.prefetch('https://cdn.example.com/action-1.mp4')
    await cache.prefetch('https://cdn.example.com/action-2.mp4')
    await cache.get('https://cdn.example.com/action-1.mp4')
    await cache.prefetch('https://cdn.example.com/action-3.mp4')

    expect(files.has('/saved/video-1.mp4')).toBe(true)
    expect(files.has('/saved/video-2.mp4')).toBe(false)
    expect(files.has('/saved/video-3.mp4')).toBe(true)
  })

  it('drops missing and expired files instead of returning stale paths', async () => {
    const { files, platform } = createPlatform()
    let timestamp = 0
    const cache = createVideoCache({
      platform,
      maxAgeMs: 10,
      now: () => timestamp
    })
    const url = 'https://cdn.example.com/action-1.mp4'

    const filePath = await cache.prefetch(url)
    files.delete(filePath as string)
    expect(await cache.get(url)).toBeNull()

    await cache.prefetch(url)
    timestamp = 11
    expect(await cache.get(url)).toBeNull()
  })

  it('falls back without throwing when the platform download fails', async () => {
    const { platform } = createPlatform()
    platform.downloadFile.mockImplementation(({ fail }: any) => fail(new Error('offline')))
    const cache = createVideoCache({ platform })

    await expect(cache.prefetch('https://cdn.example.com/action.mp4')).resolves.toBeNull()
  })

  it('evicts the oldest cached video and retries when persistent storage is full', async () => {
    const { files, platform } = createPlatform()
    let saveAttempts = 0
    platform.saveFile.mockImplementation(({ success, fail }: any) => {
      saveAttempts += 1
      if (files.size >= 1) {
        fail({ errMsg: 'saveFile:fail the maximum size of the file storage limit is exceeded' })
        return
      }
      const filePath = `/saved/recovered-${saveAttempts}.mp4`
      files.set(filePath, 20)
      success({ savedFilePath: filePath })
    })
    const cache = createVideoCache({ platform, maxEntries: 2 })

    await expect(cache.prefetch('https://cdn.example.com/action-1.mp4'))
      .resolves.toBe('/saved/recovered-1.mp4')
    await expect(cache.prefetch('https://cdn.example.com/action-2.mp4'))
      .resolves.toBe('/saved/recovered-3.mp4')
    expect(files.has('/saved/recovered-1.mp4')).toBe(false)
    expect(files.has('/saved/recovered-3.mp4')).toBe(true)
  })
})
