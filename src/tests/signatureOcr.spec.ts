import { describe, expect, it, vi } from 'vitest'
import { recognizeSignatureWithVisionKit, type SignatureOcrSession } from '../uni-app/platform/signatureOcr'

describe('VisionKit signature recognition', () => {
  it('uses static OCR and releases the native session after detection', async () => {
    let anchor!: (anchors: Array<{ text: string }>) => void
    const session: SignatureOcrSession = {
      on: (_event, handler) => { anchor = handler },
      start: handler => handler(null),
      runOCR: vi.fn(() => {
        anchor([{ text: '李' }, { text: '芳滨' }])
        expect(session.stop).not.toHaveBeenCalled()
        expect(session.destroy).not.toHaveBeenCalled()
      }), stop: vi.fn(), destroy: vi.fn()
    }
    const createVKSession = vi.fn(() => session)
    const result = await recognizeSignatureWithVisionKit({ data: new Uint8ClampedArray(16), width: 2, height: 2 }, { createVKSession })
    expect(createVKSession).toHaveBeenCalledWith({ track: { OCR: { mode: 2 } } })
    expect(result).toBe('李芳滨')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(session.destroy).toHaveBeenCalledTimes(1)
  })
  it('asks unsupported devices to update WeChat', async () => {
    await expect(recognizeSignatureWithVisionKit({ data: new Uint8ClampedArray(), width: 0, height: 0 }, {})).rejects.toThrow('更新微信')
  })
  it('releases a timed-out session and ignores late callbacks', async () => {
    vi.useFakeTimers()
    let anchor!: (anchors: Array<{ text: string }>) => void
    const session: SignatureOcrSession = { on: (_event, handler) => { anchor = handler }, start: handler => handler(null), runOCR: vi.fn(), stop: vi.fn(), destroy: vi.fn() }
    const promise = recognizeSignatureWithVisionKit({ data: new Uint8ClampedArray(4), width: 1, height: 1 }, { createVKSession: () => session })
    const assertion = expect(promise).rejects.toThrow('超时')
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
    anchor([{ text: '不应放行' }])
    await vi.advanceTimersByTimeAsync(1)
    expect(session.destroy).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
  it('cancels an active native session and rejects late detections', async () => {
    let cancel!: () => void
    let anchor!: (anchors: Array<{ text: string }>) => void
    const session: SignatureOcrSession = { on: (_event, handler) => { anchor = handler }, start: handler => handler(null), runOCR: vi.fn(), stop: vi.fn(), destroy: vi.fn() }
    const promise = recognizeSignatureWithVisionKit({ data: new Uint8ClampedArray(4), width: 1, height: 1 },
      { createVKSession: () => session }, handler => { cancel = handler })
    const assertion = expect(promise).rejects.toThrow('已取消')
    cancel()
    anchor([{ text: '迟到的识别结果' }])
    await assertion
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(session.destroy).toHaveBeenCalledOnce()
  })
})
