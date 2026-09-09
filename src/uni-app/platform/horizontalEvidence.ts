export interface HorizontalEvidence {
  /** 至少收到足够多的高精度定位点，中位速度才可用。 */
  available: boolean
  sampleCount: number
  medianSpeedMps: number | null
  /** 中位水平速度低于阈值：人基本没有水平移动，符合爬楼场景。 */
  isImmobile: boolean
}

export interface HorizontalEvidenceSession {
  stop: () => Promise<HorizontalEvidence>
}

interface LocationSample {
  speed: number | null
  accuracy: number | null
}

interface LocationResult {
  speed?: number
  accuracy?: number
}

interface ProbeMethodOptions {
  success?: () => void
  fail?: (error: unknown) => void
}

interface HorizontalEvidenceUni {
  startLocationUpdate?: (options?: ProbeMethodOptions) => unknown
  stopLocationUpdate?: (options?: ProbeMethodOptions) => unknown
  onLocationChange?: (callback: (result: LocationResult) => void) => void
  offLocationChange?: (callback?: (result: LocationResult) => void) => void
}

// 楼梯训练在一个竖直空间里完成，水平位移极小；平地走 30 秒会移动
// 30-45m。中位水平速度因此是与加速度竖直证据正交的第二判据。
const MAX_FIX_ACCURACY_M = 20
const IMMOBILE_SPEED_LIMIT_MPS = 0.6
const MIN_VALID_SAMPLES = 3
const START_TIMEOUT_MS = 5_000
const STOP_TIMEOUT_MS = 2_000

function resolveHorizontalEvidenceUni(): HorizontalEvidenceUni {
  return typeof uni === 'undefined' ? {} : (uni as unknown as HorizontalEvidenceUni)
}

function toEvidenceError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  if (error && typeof error === 'object') {
    const message = (error as { errMsg?: unknown }).errMsg
    if (typeof message === 'string' && message.trim()) {
      return new Error(message)
    }
  }

  return new Error('Horizontal evidence operation failed.')
}

async function callLocationMethod(
  invoke: (callbacks: ProbeMethodOptions) => unknown,
  timeoutMs: number,
  timeoutMessage: string
) {
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const settle = (action: 'resolve' | 'reject', error?: unknown) => {
      if (settled) {
        return
      }
      settled = true
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      if (action === 'resolve') {
        resolve()
        return
      }
      reject(toEvidenceError(error))
    }

    timeoutId = setTimeout(() => {
      settle('reject', new Error(timeoutMessage))
    }, timeoutMs)

    let result: unknown
    try {
      result = invoke({
        success: () => settle('resolve'),
        fail: error => settle('reject', error)
      })
    } catch (error) {
      settle('reject', error)
      return
    }

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).then(
        () => settle('resolve'),
        error => settle('reject', error)
      )
    }
  })
}

export async function startHorizontalEvidenceCapture(): Promise<HorizontalEvidenceSession> {
  const locationUni = resolveHorizontalEvidenceUni()
  if (
    !locationUni.startLocationUpdate ||
    !locationUni.stopLocationUpdate ||
    !locationUni.onLocationChange ||
    !locationUni.offLocationChange
  ) {
    throw new Error('Horizontal evidence APIs are unavailable.')
  }

  const samples: LocationSample[] = []
  let isActive = true
  let stopPromise: Promise<HorizontalEvidence> | null = null

  const locationHandler = (result: LocationResult) => {
    if (!isActive) {
      return
    }

    samples.push({
      speed: typeof result.speed === 'number' ? result.speed : null,
      accuracy: typeof result.accuracy === 'number' ? result.accuracy : null
    })
  }

  locationUni.onLocationChange(locationHandler)

  try {
    await callLocationMethod(
      callbacks => locationUni.startLocationUpdate?.(callbacks),
      START_TIMEOUT_MS,
      'Horizontal evidence location start timed out.'
    )
  } catch (error) {
    isActive = false
    locationUni.offLocationChange?.(locationHandler)
    locationUni.stopLocationUpdate?.()
    throw error
  }

  return {
    stop() {
      if (stopPromise) {
        return stopPromise
      }

      stopPromise = (async () => {
        isActive = false
        locationUni.offLocationChange?.(locationHandler)
        await callLocationMethod(
          callbacks => locationUni.stopLocationUpdate?.(callbacks),
          STOP_TIMEOUT_MS,
          'Horizontal evidence location stop timed out.'
        ).catch(() => {})

        // 过滤低精度定位点；部分平台在速度未知时上报负值，一并剔除。
        const validSpeeds = samples
          .filter(sample => sample.speed !== null && sample.speed >= 0)
          .filter(sample => sample.accuracy === null || sample.accuracy <= MAX_FIX_ACCURACY_M)
          .map(sample => sample.speed!)
          .sort((left, right) => left - right)

        const available = validSpeeds.length >= MIN_VALID_SAMPLES
        const middleIndex = Math.floor(validSpeeds.length / 2)
        const medianSpeedMps = available
          ? Math.round(
              (validSpeeds.length % 2 === 1
                ? validSpeeds[middleIndex]!
                : (validSpeeds[middleIndex - 1]! + validSpeeds[middleIndex]!) / 2) * 100
            ) / 100
          : null

        return {
          available,
          sampleCount: validSpeeds.length,
          medianSpeedMps,
          isImmobile: available && medianSpeedMps !== null && medianSpeedMps < IMMOBILE_SPEED_LIMIT_MPS
        }
      })()

      return stopPromise
    }
  }
}
