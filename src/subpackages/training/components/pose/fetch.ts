/**
 * TFJS fetch polyfill for the WeChat Miniprogram.
 *
 * Model files are fetched from the configured object storage origin on first use,
 * then persisted under wx.env.USER_DATA_PATH. Later detector startups read the
 * same versioned assets locally, so a device normally downloads each model
 * version only once.
 *
 * Pattern adapted from:
 *   /tmp/MultiPose-MiniProgram/src/tfjs-plugin/fetch.ts
 */
// @ts-ignore
declare const wx: any

const TEXT_FILE_EXTS = /\.(txt|json|html|xml|csv)$/i
const MODEL_CACHE_VERSION =
  import.meta.env.VITE_POSE_MODEL_VERSION?.trim() || 'blazepose-lite-v1'
const CACHE_DIRECTORY_NAME = 'pose-models'
const pendingRequests = new Map<string, Promise<Response>>()
const MODEL_BINARY_SIZES = new Map([
  ['detector/group1-shard1of2.bin', 4194304],
  ['detector/group1-shard2of2.bin', 1734552],
  ['landmark_lite/group1-shard1of1.bin', 2726402],
])

interface FileSystemManagerLike {
  access(options: {
    path: string
    success?: () => void
    fail?: (error: unknown) => void
  }): void
  mkdir(options: {
    dirPath: string
    recursive?: boolean
    success?: () => void
    fail?: (error: unknown) => void
  }): void
  readFile(options: {
    filePath: string
    encoding?: 'utf8'
    success?: (result: { data: string | ArrayBuffer }) => void
    fail?: (error: unknown) => void
  }): void
  writeFile(options: {
    filePath: string
    data: string | ArrayBuffer
    encoding?: 'utf8'
    success?: () => void
    fail?: (error: unknown) => void
  }): void
}

function hashPath(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function resolveFileExtension(path: string) {
  const cleanPath = path.split(/[?#]/, 1)[0] ?? ''
  const matched = cleanPath.match(/\.([a-z0-9]+)$/i)
  return matched ? `.${matched[1].toLowerCase()}` : '.bin'
}

function resolveCacheContext(path: string) {
  const wechat = typeof wx === 'undefined' ? undefined : wx
  const userDataPath = wechat?.env?.USER_DATA_PATH
  const getFileSystemManager = wechat?.getFileSystemManager
  if (!userDataPath || typeof getFileSystemManager !== 'function') {
    return null
  }

  const directory = `${userDataPath}/${CACHE_DIRECTORY_NAME}/${MODEL_CACHE_VERSION}`
  return {
    directory,
    filePath: `${directory}/${hashPath(path)}${resolveFileExtension(path)}`,
    fileSystem: getFileSystemManager.call(wechat) as FileSystemManagerLike,
  }
}

function accessFile(fileSystem: FileSystemManagerLike, filePath: string) {
  return new Promise<boolean>((resolve) => {
    fileSystem.access({
      path: filePath,
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

function readCachedFile(
  fileSystem: FileSystemManagerLike,
  filePath: string,
  isText: boolean,
) {
  return new Promise<string | ArrayBuffer>((resolve, reject) => {
    fileSystem.readFile({
      filePath,
      ...(isText ? { encoding: 'utf8' as const } : {}),
      success: (result) => resolve(result.data),
      fail: reject,
    })
  })
}

function writeCachedFile(
  fileSystem: FileSystemManagerLike,
  directory: string,
  filePath: string,
  data: string | ArrayBuffer,
  isText: boolean,
) {
  return new Promise<void>((resolve) => {
    fileSystem.mkdir({
      dirPath: directory,
      recursive: true,
      success: write,
      fail: write,
    })

    function write() {
      fileSystem.writeFile({
        filePath,
        data,
        ...(isText ? { encoding: 'utf8' as const } : {}),
        success: () => resolve(),
        fail: () => resolve(),
      })
    }
  })
}

function createCachedResponse(path: string, data: string | ArrayBuffer) {
  return parseResponse(path, {
    data,
    statusCode: 200,
    header: {
      'content-type': TEXT_FILE_EXTS.test(path)
        ? 'application/json'
        : 'application/octet-stream',
    },
  })
}

function validateModelPayload(path: string, data: string | ArrayBuffer) {
  const cleanPath = path.split(/[?#]/, 1)[0] ?? ''
  if (cleanPath.endsWith('.json')) {
    if (typeof data !== 'string') {
      throw new Error('JSON model manifest was not returned as text')
    }
    JSON.parse(data)
    return
  }

  if (!(data instanceof ArrayBuffer)) {
    throw new Error('Binary model shard was not returned as an ArrayBuffer')
  }

  const expectedEntry = [...MODEL_BINARY_SIZES.entries()].find(([suffix]) =>
    cleanPath.endsWith(suffix),
  )
  if (expectedEntry && data.byteLength !== expectedEntry[1]) {
    throw new Error(
      `Binary model shard has ${data.byteLength} bytes, expected ${expectedEntry[1]}`,
    )
  }
}

function parseResponse(
  url: string,
  res: WechatMiniprogram.RequestSuccessCallbackResult,
): Response {
  const header: Record<string, string> = {}
  if (res.header) {
    for (const key of Object.keys(res.header)) {
      header[key.toLowerCase()] = (res.header as any)[key]
    }
  }

  return {
    ok: res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    statusText: String(res.statusCode),
    url,
    clone: () => parseResponse(url, res),
    text: () =>
      Promise.resolve(
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
      ),
    json: () => {
      if (typeof res.data === 'object') return Promise.resolve(res.data)
      let json = {}
      try {
        json = JSON.parse(res.data as string)
      } catch (_err) {
        /* leave as {} */
      }
      return Promise.resolve(json)
    },
    arrayBuffer: () => Promise.resolve(res.data as ArrayBuffer),
    headers: {
      keys: () => Object.keys(header),
      entries: () => {
        const all: Array<[string, string]> = []
        for (const key of Object.keys(header)) {
          all.push([key, header[key]])
        }
        return all
      },
      get: (n: string) => header[n.toLowerCase()] ?? null,
      has: (n: string) => n.toLowerCase() in header,
    },
    blob: () => {
      throw new Error('blob() not implemented in WeChat Miniprogram')
    },
    formData: () => {
      throw new Error('formData() not implemented in WeChat Miniprogram')
    },
    redirected: false,
    type: 'basic' as ResponseType,
  } as unknown as Response
}

function requestNetwork(
  path: string,
  requestInits?: RequestInit,
): Promise<Response> {
  const opts = requestInits ?? {}
  const method = opts.method?.toUpperCase() ?? 'GET'
  const isText = TEXT_FILE_EXTS.test(path)
  const dataType: string = isText ? 'text' : 'arraybuffer'

  return new Promise((resolve, reject) => {
    let successed = false
    const onSuccess = async (resp: any) => {
      if (successed) return
      successed = true
      const cacheContext = resolveCacheContext(path)
      if (
        method === 'GET' &&
        cacheContext &&
        resp.statusCode >= 200 &&
        resp.statusCode < 300
      ) {
        try {
          validateModelPayload(path, resp.data)
          await writeCachedFile(
            cacheContext.fileSystem,
            cacheContext.directory,
            cacheContext.filePath,
            resp.data,
            isText,
          )
        } catch {
          // Invalid JSON responses are returned to the caller but never persisted.
        }
      }
      resolve(parseResponse(path, resp))
    }

    // @ts-ignore
    wx.request({
      url: path,
      method: (opts.method as any) ?? 'GET',
      data: opts.body,
      header: opts.headers,
      dataType,
      responseType: dataType,
      enableCache: true,
      success: onSuccess,
      fail: (err: any) => reject(new Error(err?.errMsg ?? 'request failed')),
    })
  })
}

async function fetchWithPersistentCache(
  path: string,
  requestInits?: RequestInit,
) {
  const method = requestInits?.method?.toUpperCase() ?? 'GET'
  const cacheContext = method === 'GET' ? resolveCacheContext(path) : null
  if (!cacheContext) {
    return requestNetwork(path, requestInits)
  }

  const exists = await accessFile(
    cacheContext.fileSystem,
    cacheContext.filePath,
  )
  if (exists) {
    try {
      const data = await readCachedFile(
        cacheContext.fileSystem,
        cacheContext.filePath,
        TEXT_FILE_EXTS.test(path),
      )
      validateModelPayload(path, data)
      return createCachedResponse(path, data)
    } catch {
      // A partial or externally removed cache entry is repaired from the origin.
    }
  }

  return requestNetwork(path, requestInits)
}

export function fetchFunc(
  path: string,
  requestInits?: RequestInit,
): Promise<Response> {
  const method = requestInits?.method?.toUpperCase() ?? 'GET'
  if (method !== 'GET') {
    return requestNetwork(path, requestInits)
  }

  const existing = pendingRequests.get(path)
  if (existing) {
    return existing.then((response) => response.clone())
  }

  const request = fetchWithPersistentCache(path, requestInits).finally(() =>
    pendingRequests.delete(path),
  )
  pendingRequests.set(path, request)
  return request
}
