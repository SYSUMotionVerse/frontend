import { prepareSignatureOcrPixels } from './signatureOcrImage'

export interface SignaturePixels { data: Uint8ClampedArray, width: number, height: number }
export interface SignatureOcrSession {
  on(event: 'updateAnchors', callback: (anchors: Array<{ text?: string }>) => void): void
  start(callback: (error: number | null) => void): void
  runOCR(input: { frameBuffer: ArrayBuffer, width: number, height: number }): void
  stop(): void
  destroy(): void
}
type VisionKitRuntime = { createVKSession?: (options: { track: { OCR: { mode: 2 } } }) => SignatureOcrSession }
declare const wx: VisionKitRuntime
export const SIGNATURE_OCR_START_TIMEOUT = 15000
export const SIGNATURE_OCR_DETECTION_TIMEOUT = 10000

export function normalizeSignatureName(value: string) { return value.normalize('NFKC').replace(/\s/g, '') }

export function createSignatureRecognizer(runtime: VisionKitRuntime = typeof wx === 'undefined' ? {} : wx) {
  let session: SignatureOcrSession | undefined
  let startup: Promise<void> | undefined
  let abortStartup: ((error: Error) => void) | undefined
  let detection: ((text?: string, error?: Error) => void) | undefined
  let generation = 0
  const log = (stage: string, started: number, details: Record<string, number | string> = {}) => {
    // Keep diagnostic timings available without logging a name or image.
    console.info('[consent-signature]', { stage, elapsed_ms: Date.now() - started, ...details })
  }
  const dispose = () => {
    generation++
    const old = session
    session = undefined
    startup = undefined
    abortStartup?.(new Error('signature_start_cancelled'))
    detection?.(undefined, new Error('signature_detection_cancelled'))
    setTimeout(() => {
      try { old?.stop() } catch { /* Release after native failures too. */ }
      try { old?.destroy() } catch { /* Never destroy inside an anchors callback. */ }
    }, 0)
  }
  function prepare(): Promise<void> {
    if (startup) return startup
    if (!runtime.createVKSession) return Promise.reject(new Error('signature_ocr_unsupported'))
    const cycle = ++generation, started = Date.now()
    // Assign the cached promise before running start(), whose callback may be
    // synchronous on a warm device. A rejected startup must never be cached.
    startup = Promise.resolve().then(() => new Promise<void>((resolve, reject) => {
      if (generation !== cycle) { reject(new Error('signature_start_cancelled')); return }
      let settled = false
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        abortStartup = undefined
        log(error ? 'startup_failed' : 'startup_ready', started, error ? { code: error.message } : {})
        if (error) reject(error)
        else resolve()
      }
      const timer = setTimeout(() => { finish(new Error(`signature_start_timeout;elapsed_ms=${Date.now() - started}`)); dispose() }, SIGNATURE_OCR_START_TIMEOUT)
      abortStartup = error => finish(error)
      try {
        session = runtime.createVKSession!({ track: { OCR: { mode: 2 } } })
        session.on('updateAnchors', anchors => {
          if (cycle === generation) detection?.(anchors.map(anchor => anchor.text ?? '').join(''))
        })
        session.start(errno => {
          if (settled || cycle !== generation) return
          if (errno) { finish(new Error(`signature_start_failed;errno=${errno}`)); dispose() }
          else finish()
        })
      } catch { finish(new Error('signature_start_failed')); dispose() }
    })).catch(error => { if (cycle === generation) dispose(); throw error })
    return startup
  }
  async function recognize(source: SignaturePixels, registerCancel?: (cancel: () => void) => void): Promise<string> {
    let cancelled = false
    registerCancel?.(() => { cancelled = true; dispose() })
    if (cancelled) throw new Error('signature_detection_cancelled')
    await prepare()
    if (cancelled || !session) throw new Error('signature_detection_cancelled')
    if (detection) throw new Error('signature_detection_busy')
    const pixels = prepareSignatureOcrPixels(source)
    const cycle = generation, started = Date.now()
    return new Promise<string>((resolve, reject) => {
      let settled = false
      const finish = (text?: string, error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (detection === finish) detection = undefined
        log(error ? 'detection_failed' : 'detection_complete', started, { width: pixels.width, height: pixels.height, ...(error ? { code: error.message } : {}) })
        if (error) reject(error)
        else resolve(text ?? '')
      }
      const timer = setTimeout(() => {
        finish(undefined, new Error(`signature_detection_timeout;elapsed_ms=${Date.now() - started}`))
        if (generation === cycle) dispose()
      }, SIGNATURE_OCR_DETECTION_TIMEOUT)
      detection = finish
      try { session!.runOCR({ frameBuffer: pixels.data.slice().buffer, width: pixels.width, height: pixels.height }) }
      catch { finish(undefined, new Error('signature_detection_failed')); dispose() }
    })
  }
  return { prepare, recognize, dispose }
}
