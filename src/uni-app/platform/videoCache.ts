export interface VideoCache {
  get: (url: string) => Promise<string | null>
  prefetch: (url: string) => Promise<string | null>
  evict: (url: string) => Promise<void>
  clear: () => Promise<void>
}

interface VideoCacheEntry {
  url: string
  filePath: string
  size: number
  cachedAt: number
  lastUsedAt: number
}

interface StoredVideoCache {
  version: 1
  entries: VideoCacheEntry[]
}

interface VideoCachePlatform {
  getStorageSync: (key: string) => unknown
  setStorageSync: (key: string, value: unknown) => void
  downloadFile: (options: {
    url: string
    timeout?: number
    success?: (result: { tempFilePath: string; statusCode: number }) => void
    fail?: (error: unknown) => void
  }) => unknown
  saveFile: (options: {
    tempFilePath: string
    success?: (result: { savedFilePath: string }) => void
    fail?: (error: unknown) => void
  }) => unknown
  getSavedFileInfo?: (options: {
    filePath: string
    success?: (result: { size: number }) => void
    fail?: (error: unknown) => void
  }) => unknown
  removeSavedFile?: (options: {
    filePath: string
    complete?: () => void
  }) => unknown
}

interface CreateVideoCacheOptions {
  platform?: VideoCachePlatform | null
  storageKey?: string
  maxEntries?: number
  maxBytes?: number
  maxAgeMs?: number
  now?: () => number
}

const defaultStorageKey = 'sport-snack:training-video-cache:v1'
const defaultMaxEntries = 3
const defaultMaxBytes = 180 * 1024 * 1024
const defaultMaxAgeMs = 7 * 24 * 60 * 60 * 1000
const downloadTimeoutMs = 60_000

function resolveDefaultPlatform(): VideoCachePlatform | null {
  return typeof uni === 'undefined' ? null : uni as unknown as VideoCachePlatform
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isVideoCacheEntry(value: unknown): value is VideoCacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<VideoCacheEntry>
  return typeof entry.url === 'string' &&
    typeof entry.filePath === 'string' &&
    isFiniteNonNegative(entry.size) &&
    isFiniteNonNegative(entry.cachedAt) &&
    isFiniteNonNegative(entry.lastUsedAt)
}

function normalizeUrl(url: string) {
  const normalized = url.trim()
  return /^https?:\/\//i.test(normalized) ? normalized : ''
}

export function createVideoCache(options: CreateVideoCacheOptions = {}): VideoCache {
  const platform = options.platform === undefined ? resolveDefaultPlatform() : options.platform
  const storageKey = options.storageKey ?? defaultStorageKey
  const maxEntries = Math.max(1, options.maxEntries ?? defaultMaxEntries)
  const maxBytes = Math.max(1, options.maxBytes ?? defaultMaxBytes)
  const maxAgeMs = Math.max(1, options.maxAgeMs ?? defaultMaxAgeMs)
  const now = options.now ?? Date.now
  const pending = new Map<string, Promise<string | null>>()
  let entries: VideoCacheEntry[] | null = null

  function loadEntries() {
    if (entries) return entries
    if (!platform) return (entries = [])

    try {
      const stored = platform.getStorageSync(storageKey) as Partial<StoredVideoCache> | null
      entries = stored?.version === 1 && Array.isArray(stored.entries)
        ? stored.entries.filter(isVideoCacheEntry)
        : []
    } catch {
      entries = []
    }
    return entries
  }

  function persist() {
    if (!platform) return
    try {
      platform.setStorageSync(storageKey, {
        version: 1,
        entries: loadEntries()
      } satisfies StoredVideoCache)
    } catch {
      // Cache metadata must never block training playback.
    }
  }

  function removeFile(filePath: string) {
    return new Promise<void>(resolve => {
      if (!platform?.removeSavedFile) {
        resolve()
        return
      }
      platform.removeSavedFile({ filePath, complete: resolve })
    })
  }

  async function removeEntry(entry: VideoCacheEntry) {
    entries = loadEntries().filter(item => item.url !== entry.url)
    persist()
    await removeFile(entry.filePath)
  }

  function inspectFile(filePath: string) {
    return new Promise<number | null>(resolve => {
      if (!platform?.getSavedFileInfo) {
        resolve(0)
        return
      }
      platform.getSavedFileInfo({
        filePath,
        success: result => resolve(result.size),
        fail: () => resolve(null)
      })
    })
  }

  async function get(url: string) {
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) return null

    const entry = loadEntries().find(item => item.url === normalizedUrl)
    if (!entry) return null
    if (now() - entry.cachedAt >= maxAgeMs) {
      await removeEntry(entry)
      return null
    }

    const inspectedSize = await inspectFile(entry.filePath)
    if (inspectedSize === null) {
      await removeEntry(entry)
      return null
    }

    entry.size = inspectedSize || entry.size
    entry.lastUsedAt = now()
    persist()
    return entry.filePath
  }

  function download(url: string) {
    return new Promise<string>((resolve, reject) => {
      if (!platform) {
        reject(new Error('Video downloads are unavailable.'))
        return
      }
      platform.downloadFile({
        url,
        timeout: downloadTimeoutMs,
        success: result => {
          if (result.statusCode < 200 || result.statusCode >= 300 || !result.tempFilePath) {
            reject(new Error(`Video download failed with ${result.statusCode}.`))
            return
          }
          resolve(result.tempFilePath)
        },
        fail: reject
      })
    })
  }

  function save(tempFilePath: string) {
    return new Promise<string>((resolve, reject) => {
      if (!platform) {
        reject(new Error('Video persistence is unavailable.'))
        return
      }
      platform.saveFile({
        tempFilePath,
        success: result => resolve(result.savedFilePath),
        fail: reject
      })
    })
  }

  async function saveWithRecovery(tempFilePath: string) {
    try {
      return await save(tempFilePath)
    } catch (error) {
      const oldest = [...loadEntries()]
        .sort((left, right) => left.lastUsedAt - right.lastUsedAt)
        .at(0)
      if (!oldest) throw error

      await removeEntry(oldest)
      return await save(tempFilePath)
    }
  }

  async function trim() {
    const ordered = [...loadEntries()].sort((left, right) => left.lastUsedAt - right.lastUsedAt)
    let totalBytes = ordered.reduce((total, entry) => total + entry.size, 0)
    while (ordered.length > maxEntries || totalBytes > maxBytes) {
      const oldest = ordered.shift()
      if (!oldest) break
      totalBytes -= oldest.size
      await removeEntry(oldest)
    }
  }

  function prefetch(url: string) {
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl || !platform) return Promise.resolve(null)

    const existingRequest = pending.get(normalizedUrl)
    if (existingRequest) return existingRequest

    const request = (async () => {
      const cachedPath = await get(normalizedUrl)
      if (cachedPath) return cachedPath

      try {
        const tempFilePath = await download(normalizedUrl)
        const filePath = await saveWithRecovery(tempFilePath)
        const size = await inspectFile(filePath)
        if (size === null || size > maxBytes) {
          await removeFile(filePath)
          return null
        }

        const timestamp = now()
        entries = [
          ...loadEntries().filter(entry => entry.url !== normalizedUrl),
          {
            url: normalizedUrl,
            filePath,
            size,
            cachedAt: timestamp,
            lastUsedAt: timestamp
          }
        ]
        persist()
        await trim()
        return loadEntries().some(entry => entry.url === normalizedUrl) ? filePath : null
      } catch {
        return null
      }
    })().finally(() => {
      pending.delete(normalizedUrl)
    })

    pending.set(normalizedUrl, request)
    return request
  }

  async function clear() {
    const currentEntries = [...loadEntries()]
    entries = []
    persist()
    await Promise.all(currentEntries.map(entry => removeFile(entry.filePath)))
  }

  async function evict(url: string) {
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) return
    const entry = loadEntries().find(item => item.url === normalizedUrl)
    if (entry) await removeEntry(entry)
  }

  return { get, prefetch, evict, clear }
}

export const trainingVideoCache = createVideoCache()
