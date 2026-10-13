import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSignatureRecognizer, type SignatureOcrSession } from '../uni-app/platform/signatureOcr'

const pixels = () => { const data = new Uint8ClampedArray(64 * 32 * 4).fill(255); data.set([32, 51, 68, 255], (10 * 64 + 20) * 4); return { data, width: 64, height: 32 } }
function native(automaticStart = true) {
  let anchor!: (anchors: Array<{ text: string }>) => void
  let started!: (error: number | null) => void
  const session: SignatureOcrSession = {
    on: (_event, callback) => { anchor = callback },
    start: vi.fn(callback => { started = callback; if (automaticStart) callback(null) }),
    runOCR: vi.fn(), stop: vi.fn(), destroy: vi.fn()
  }
  return { session, anchors: (text: string) => anchor([{ text }]), start: (errno: number | null = null) => started(errno) }
}
const runtime = (createVKSession: () => SignatureOcrSession) => ({ createVKSession, getAppBaseInfo: () => ({ SDKVersion: '3.11.0' }), isVKSupport: () => true })

describe('page-scoped VisionKit recognition', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'info').mockImplementation(() => {}) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
  it('prewarms once and reuses a ready session across signatures without destroying it in an anchors callback', async () => {
    const { session, anchors } = native()
    const createVKSession = vi.fn(() => session)
    const recognizer = createSignatureRecognizer(runtime(createVKSession))
    await recognizer.prepare()
    for (const name of ['李芳滨', '李芳滨']) {
      const promise = recognizer.recognize(pixels())
      await flushPromises()
      anchors(name)
      expect(await promise).toBe(name)
      expect(session.stop).not.toHaveBeenCalled()
    }
    expect(createVKSession).toHaveBeenCalledTimes(1)
    expect(session.start).toHaveBeenCalledTimes(1)
    expect(session.runOCR).toHaveBeenCalledTimes(2)
    expect(createVKSession).toHaveBeenCalledWith({ version: 'v1', track: { OCR: { mode: 2 } } })
    recognizer.dispose()
    await vi.advanceTimersByTimeAsync(1)
    expect(session.destroy).toHaveBeenCalledTimes(1)
  })
  it('allows a slow startup and gives detection a fresh budget instead of including startup in six seconds', async () => {
    const { session, anchors, start } = native(false)
    const recognizer = createSignatureRecognizer(runtime(() => session))
    const result = recognizer.recognize(pixels())
    await flushPromises()
    await vi.advanceTimersByTimeAsync(9000)
    expect(session.runOCR).not.toHaveBeenCalled()
    start()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(8000)
    anchors('李芳滨')
    await expect(result).resolves.toBe('李芳滨')
    recognizer.dispose()
  })
  it('records a startup deadline separately from a detection deadline and permits a fresh session', async () => {
    const first = native(false), second = native()
    const factory = vi.fn().mockReturnValueOnce(first.session).mockReturnValue(second.session)
    const recognizer = createSignatureRecognizer(runtime(factory))
    const result = recognizer.recognize(pixels())
    const assertion = expect(result).rejects.toThrow('signature_start_timeout')
    await vi.advanceTimersByTimeAsync(15000)
    await assertion
    await vi.advanceTimersByTimeAsync(1)
    expect(console.info).toHaveBeenCalledWith('[consent-signature]', expect.objectContaining({ stage: 'startup_failed', elapsed_ms: 15000 }))
    const retry = recognizer.recognize(pixels())
    await flushPromises()
    first.start() // A late callback from the discarded startup cannot run OCR.
    expect(first.session.runOCR).not.toHaveBeenCalled()
    second.anchors('李芳滨')
    await expect(retry).resolves.toBe('李芳滨')
    recognizer.dispose()
  })
  it('discards a timed-out detection session and ignores its late anchors during retry', async () => {
    const first = native(), second = native()
    const recognizer = createSignatureRecognizer(runtime(vi.fn().mockReturnValueOnce(first.session).mockReturnValue(second.session)))
    const result = recognizer.recognize(pixels())
    const assertion = expect(result).rejects.toThrow('signature_detection_timeout')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10000)
    await assertion
    await vi.advanceTimersByTimeAsync(1)
    const retry = recognizer.recognize(pixels())
    await flushPromises()
    first.anchors('错误的迟到结果')
    second.anchors('李芳滨')
    await expect(retry).resolves.toBe('李芳滨')
    recognizer.dispose()
  })
  it('cancels startup immediately and never creates a session for an already-cancelled request', async () => {
    const item = native(false), factory = vi.fn(() => item.session)
    const recognizer = createSignatureRecognizer(runtime(factory))
    await expect(recognizer.recognize(pixels(), cancel => cancel())).rejects.toThrow('cancelled')
    expect(factory).not.toHaveBeenCalled()
    let cancel!: () => void
    const result = recognizer.recognize(pixels(), callback => { cancel = callback })
    const assertion = expect(result).rejects.toThrow('cancelled')
    await flushPromises()
    cancel()
    await assertion
    item.start()
    expect(item.session.runOCR).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(item.session.destroy).toHaveBeenCalledOnce()
  })
  it('reports unsupported devices internally without pretending recognition succeeded', async () => {
    await expect(createSignatureRecognizer({}).recognize(pixels())).rejects.toThrow('signature_ocr_unsupported')
  })
  it('finishes releasing a discarded native session before creating the retry session', async () => {
    const first = native(), second = native()
    const factory = vi.fn().mockReturnValueOnce(first.session).mockImplementation(() => {
      expect(first.session.destroy).toHaveBeenCalledOnce()
      return second.session
    })
    const recognizer = createSignatureRecognizer(runtime(factory))
    await recognizer.prepare()
    recognizer.dispose()
    const retry = recognizer.recognize(pixels()); await flushPromises()
    expect(factory).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1); await flushPromises()
    expect(factory).toHaveBeenCalledTimes(2)
    first.anchors('迟到结果'); second.anchors('李芳滨')
    await expect(retry).resolves.toBe('李芳滨')
    recognizer.dispose()
  })
  it.each(['2.26.9', 'invalid', ''])('never enters native creation with unsupported or unknown SDK %s', async SDKVersion => {
    const factory = vi.fn(() => native().session)
    const recognizer = createSignatureRecognizer({ ...runtime(factory), getAppBaseInfo: () => ({ SDKVersion }) })
    await expect(recognizer.recognize(pixels())).rejects.toThrow('signature_ocr_unsupported')
    expect(factory).not.toHaveBeenCalled()
  })
  it('checks device support and validates pixel data before creating any native session', async () => {
    const factory = vi.fn(() => native().session)
    const recognizer = createSignatureRecognizer({ ...runtime(factory), isVKSupport: () => false })
    await expect(recognizer.recognize(pixels())).rejects.toThrow('signature_ocr_unsupported')
    await expect(createSignatureRecognizer(runtime(factory)).recognize({ width: 2, height: 2, data: new Uint8ClampedArray(3) })).rejects.toThrow('signature_input_invalid')
    expect(factory).not.toHaveBeenCalled()
  })
  it('records the stage before native entry and archives no signature text or pixel buffer', async () => {
    const item = native(), records: Array<Record<string, unknown>> = []
    const setStorageSync = vi.fn((_key, value) => records.push(value))
    const createVKSession = vi.fn(() => { expect(records.at(-1)?.stage).toBe('session_create_begin'); return item.session })
    vi.mocked(item.session.runOCR).mockImplementation(input => {
      expect(records.at(-1)?.stage).toBe('detection_begin')
      expect(input.frameBuffer).toBeInstanceOf(ArrayBuffer)
      expect(input.frameBuffer.byteLength).toBe(input.width * input.height * 4)
    })
    const recognizer = createSignatureRecognizer({ ...runtime(createVKSession), setStorageSync,
      getStorageSync: () => ({ stage: 'session_start_begin', timestamp: 123 }) })
    const result = recognizer.recognize(pixels()); await flushPromises()
    item.anchors('李芳滨'); expect(await result).toBe('李芳滨')
    expect(console.info).toHaveBeenCalledWith('[consent-signature]', expect.objectContaining({ stage: 'previous_native_stage', previous_stage: 'session_start_begin' }))
    expect(JSON.stringify(records)).not.toMatch(/李芳滨|frameBuffer|data:image/)
    expect(item.session.destroy).not.toHaveBeenCalled()
    recognizer.dispose(); await vi.advanceTimersByTimeAsync(1)
    expect(records.at(-1)?.stage).toBe('session_released')
  })
})
