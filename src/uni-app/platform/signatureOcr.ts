import { prepareSignatureOcrPixels } from './signatureOcrImage'

export interface SignaturePixels { data: Uint8ClampedArray, width: number, height: number }
export interface SignatureOcrSession {
  on(event: 'updateAnchors', callback: (anchors: Array<{ text?: string }>) => void): void
  start(callback: (error: number | null) => void): void
  runOCR(input: { frameBuffer: ArrayBuffer, width: number, height: number }): void
  stop(): void
  destroy(): void
}
type SignatureOcrInput = Parameters<SignatureOcrSession['runOCR']>[0]
type VisionKitRuntime = {
  createVKSession?: (options: { version: 'v1', track: { OCR: { mode: 2 } } }) => SignatureOcrSession
  getAppBaseInfo?: () => { SDKVersion?: string }
  getSystemInfoSync?: () => { SDKVersion?: string }
  isVKSupport?: (version: 'v1') => boolean
  getStorageSync?: (key: string) => unknown
  setStorageSync?: (key: string, value: unknown) => void
}
declare const wx: VisionKitRuntime
export const SIGNATURE_OCR_START_TIMEOUT = 15000
export const SIGNATURE_OCR_DETECTION_TIMEOUT = 10000
const diagnosticKey = 'sport-snack:signature-native-stage'
const nativeStages = ['session_create_begin', 'session_created', 'session_start_begin', 'startup_ready', 'startup_failed', 'detection_begin', 'detection_dispatched', 'detection_complete', 'detection_failed', 'session_release_begin', 'session_released', 'unsupported']

function supported(runtime: VisionKitRuntime) {
  let sdk = ''
  try { sdk = runtime.getAppBaseInfo?.().SDKVersion ?? '' } catch { /* Try the older API below. */ }
  if (!sdk) try { sdk = runtime.getSystemInfoSync?.().SDKVersion ?? '' } catch { /* Fail closed without version information. */ }
  if (!/^\d+\.\d+\.\d+$/.test(sdk)) return false
  const [major, minor] = sdk.split('.').map(Number)
  if (major! < 2 || (major === 2 && minor! < 27)) return false
  try { return !!runtime.createVKSession && (!runtime.isVKSupport || runtime.isVKSupport('v1')) }
  catch { return false }
}

export function normalizeSignatureName(value: string) { return value.normalize('NFKC').replace(/\s/g, '') }

export function createSignatureRecognizer(runtime: VisionKitRuntime = typeof wx === 'undefined' ? {} : wx) {
  let session: SignatureOcrSession | undefined
  let startup: Promise<void> | undefined
  let abortStartup: ((error: Error) => void) | undefined
  let detection: ((text?: string, error?: Error) => void) | undefined
  let input: SignatureOcrInput | undefined
  let releasing = Promise.resolve()
  let generation = 0
  try {
    const previous = runtime.getStorageSync?.(diagnosticKey) as { stage?: unknown, timestamp?: unknown } | undefined
    if (previous && nativeStages.includes(String(previous.stage)) && typeof previous.timestamp === 'number') {
      console.info('[consent-signature]', { stage: 'previous_native_stage', previous_stage: previous.stage, timestamp: previous.timestamp })
    }
  } catch { /* Diagnostics must not prevent signing. */ }
  const log = (stage: string, started: number, details: Record<string, number | string> = {}) => {
    // Keep diagnostic timings available without logging a name or image.
    const record = { stage, elapsed_ms: Date.now() - started, timestamp: Date.now(), ...details }
    console.info('[consent-signature]', record)
    try { runtime.setStorageSync?.(diagnosticKey, record) } catch { /* Store only the latest nonpersonal stage. */ }
  }
  const dispose = () => {
    generation++
    const old = session
    const oldInput = input
    input = undefined
    session = undefined
    startup = undefined
    abortStartup?.(new Error('signature_start_cancelled'))
    detection?.(undefined, new Error('signature_detection_cancelled'))
    if (old) releasing = releasing.then(() => new Promise<void>(resolve => setTimeout(() => {
      const started = Date.now()
      log('session_release_begin', started)
      try { old?.stop() } catch { /* Release after native failures too. */ }
      try { old?.destroy() } catch { /* Never destroy inside an anchors callback. */ }
      // Retain the exact buffer passed across the native bridge until release.
      log('session_released', started, { bytes: oldInput?.frameBuffer.byteLength ?? 0 })
      resolve()
    }, 0)))
  }
  function prepare(): Promise<void> {
    if (startup) return startup
    if (!supported(runtime)) { log('unsupported', Date.now()); return Promise.reject(new Error('signature_ocr_unsupported')) }
    const cycle = ++generation, started = Date.now()
    // Assign the cached promise before running start(), whose callback may be
    // synchronous on a warm device. A rejected startup must never be cached.
    startup = releasing.then(() => new Promise<void>((resolve, reject) => {
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
        log('session_create_begin', started)
        session = runtime.createVKSession!({ version: 'v1', track: { OCR: { mode: 2 } } })
        log('session_created', started)
        session.on('updateAnchors', anchors => {
          if (cycle === generation) detection?.(anchors.map(anchor => anchor.text ?? '').join(''))
        })
        log('session_start_begin', started)
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
    const pixels = prepareSignatureOcrPixels(source)
    await prepare()
    if (cancelled || !session) throw new Error('signature_detection_cancelled')
    if (detection) throw new Error('signature_detection_busy')
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
      try {
        input = { frameBuffer: pixels.data.slice().buffer, width: pixels.width, height: pixels.height }
        log('detection_begin', started, { width: input.width, height: input.height, bytes: input.frameBuffer.byteLength })
        session!.runOCR(input)
        if (!settled) log('detection_dispatched', started)
      }
      catch { finish(undefined, new Error('signature_detection_failed')); dispose() }
    })
  }
  return { prepare, recognize, dispose }
}
