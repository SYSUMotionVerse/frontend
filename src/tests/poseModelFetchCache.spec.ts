import { beforeEach, describe, expect, it, vi } from 'vitest'

type StoredFile = string | ArrayBuffer

function createWxMock() {
  const files = new Map<string, StoredFile>()
  const fileSystem = {
    access: vi.fn(({ path, success, fail }: any) => {
      if (files.has(path)) {
        success?.({})
        return
      }
      fail?.({ errMsg: 'access:fail no such file' })
    }),
    mkdir: vi.fn(({ success }: any) => success?.({})),
    readFile: vi.fn(({ filePath, encoding, success, fail }: any) => {
      const data = files.get(filePath)
      if (data === undefined) {
        fail?.({ errMsg: 'readFile:fail no such file' })
        return
      }
      success?.({
        data:
          encoding === 'utf8' && data instanceof ArrayBuffer
            ? new TextDecoder().decode(data)
            : data,
      })
    }),
    writeFile: vi.fn(({ filePath, data, success }: any) => {
      files.set(filePath, data)
      success?.({})
    }),
  }
  const request = vi.fn(({ url, success }: any) => {
    success({
      data: url.endsWith('.json')
        ? '{"modelTopology":{},"weightsManifest":[]}'
        : new Uint8Array([1, 2, 3, 4]).buffer,
      statusCode: 200,
      header: {
        'Content-Type': url.endsWith('.json')
          ? 'application/json'
          : 'application/octet-stream',
      },
    })
  })

  return {
    files,
    wx: {
      env: { USER_DATA_PATH: '/user-data' },
      getFileSystemManager: () => fileSystem,
      request,
    },
  }
}

describe('pose model fetch cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('downloads a model asset once and serves later reads from persistent storage', async () => {
    vi.stubEnv('VITE_POSE_MODEL_VERSION', 'blazepose-lite-v1')
    const { files, wx } = createWxMock()
    vi.stubGlobal('wx', wx)
    const { fetchFunc } = await import('../subpackages/training/components/pose/fetch')
    const url = 'https://models.example.com/pose/detector/model.json'

    const first = await fetchFunc(url)
    const second = await fetchFunc(url)

    expect(await first.json()).toEqual({
      modelTopology: {},
      weightsManifest: [],
    })
    expect(await second.json()).toEqual({
      modelTopology: {},
      weightsManifest: [],
    })
    expect(wx.request).toHaveBeenCalledTimes(1)
    expect(files.size).toBe(1)
    expect([...files.keys()][0]).toContain('/pose-models/blazepose-lite-v1/')
  })

  it('falls back to the network when persistent storage is unavailable', async () => {
    const { wx } = createWxMock()
    vi.stubGlobal('wx', {
      env: wx.env,
      request: wx.request,
    })
    const { fetchFunc } = await import('../subpackages/training/components/pose/fetch')

    const response = await fetchFunc(
      'https://models.example.com/pose/landmark_lite/model.json',
    )

    expect(response.ok).toBe(true)
    expect(wx.request).toHaveBeenCalledTimes(1)
  })

  it('repairs an invalid cached model manifest from the OSS origin', async () => {
    vi.stubEnv('VITE_POSE_MODEL_VERSION', 'blazepose-lite-v1')
    const { files, wx } = createWxMock()
    vi.stubGlobal('wx', wx)
    const { fetchFunc } = await import('../subpackages/training/components/pose/fetch')
    const url = 'https://models.sport-snack.cn/pose/detector/model.json'

    await fetchFunc(url)
    const [cachePath] = [...files.keys()]
    files.set(cachePath, '<html>gateway error</html>')
    const repaired = await fetchFunc(url)

    expect(await repaired.json()).toEqual({
      modelTopology: {},
      weightsManifest: [],
    })
    expect(wx.request).toHaveBeenCalledTimes(2)
  })

  it('repairs a truncated binary shard instead of reusing it forever', async () => {
    vi.stubEnv('VITE_POSE_MODEL_VERSION', 'blazepose-lite-v1')
    const { files, wx } = createWxMock()
    const shard = new ArrayBuffer(1734552)
    wx.request.mockImplementation(({ success }: any) =>
      success({
        data: shard,
        statusCode: 200,
        header: { 'Content-Type': 'application/octet-stream' },
      }),
    )
    vi.stubGlobal('wx', wx)
    const { fetchFunc } = await import('../subpackages/training/components/pose/fetch')
    const url =
      'https://models.sport-snack.cn/pose/detector/group1-shard2of2.bin'

    await fetchFunc(url)
    const [cachePath] = [...files.keys()]
    files.set(cachePath, new ArrayBuffer(20))
    const repaired = await fetchFunc(url)

    expect((await repaired.arrayBuffer()).byteLength).toBe(1734552)
    expect(wx.request).toHaveBeenCalledTimes(2)
  })

  it('does not persist non-GET responses in the model cache', async () => {
    const { files, wx } = createWxMock()
    vi.stubGlobal('wx', wx)
    const { fetchFunc } = await import('../subpackages/training/components/pose/fetch')

    await fetchFunc('https://models.sport-snack.cn/pose/detector/model.json', {
      method: 'POST',
    })

    expect(files.size).toBe(0)
  })
})
