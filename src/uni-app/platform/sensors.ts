export interface SensorSample {
  timestampMs: number
  acceleration: {
    x: number
    y: number
    z: number
  }
}

export interface SensorSessionAnalysis {
  qualityScore: number
  summary: string
  capturedBy: 'sensor'
  estimatedStepCount: number
  activeClimbSeconds: number
  cadenceSpmAvg: number
  cadenceSpmPeak: number
  cadenceStability: number
  estimatedVerticalSpeedMps: number
  estimatedFloorsPerMin: number
  pauseCount: number
  confidence: number
  completedIntervals: number
  durationSeconds: number
}

export interface GyroscopeSample {
  timestampMs: number
  rotationRate: {
    x: number
    y: number
    z: number
  }
}

export interface StairSensorCaptureSnapshot {
  startedAtMs: number
  samples: SensorSample[]
  latestGyroscope: GyroscopeSample | null
  analysis: SensorSessionAnalysis
}

export interface StairSensorCaptureResult extends StairSensorCaptureSnapshot {}

export interface StartStairSensorCaptureInput {
  completedIntervals: number
  accelerometerInterval?: MotionInterval
  gyroscopeInterval?: MotionInterval
}

export interface StopStairSensorCaptureInput {
  durationSeconds?: number
  completedIntervals?: number
}

export interface StairSensorCaptureSession {
  getSnapshot(input?: StopStairSensorCaptureInput): StairSensorCaptureSnapshot
  stop(input?: StopStairSensorCaptureInput): Promise<StairSensorCaptureResult>
}

interface SensorAnalysisInput {
  durationSeconds?: number
  completedIntervals: number
  samples?: SensorSample[]
}

type MotionInterval = 'game' | 'ui' | 'normal'

interface MotionVector {
  x: number
  y: number
  z: number
}

interface UniMotionSensor {
  startAccelerometer?: (options?: SensorMethodOptions & { interval?: MotionInterval }) => unknown
  stopAccelerometer?: (options?: SensorMethodOptions) => unknown
  onAccelerometerChange?: (callback: (result: MotionVector) => void) => void
  offAccelerometerChange?: (callback?: (result: MotionVector) => void) => void
  startGyroscope?: (options?: SensorMethodOptions & { interval?: MotionInterval }) => unknown
  stopGyroscope?: (options?: SensorMethodOptions) => unknown
  onGyroscopeChange?: (callback: (result: MotionVector) => void) => void
  offGyroscopeChange?: (callback?: (result: MotionVector) => void) => void
}

interface SensorMethodOptions {
  success?: () => void
  fail?: (error: unknown) => void
}

type SensorMethodKind = 'callback' | 'promise'

const GRAVITY_BASELINE = 9.81
const STEP_PEAK_DELTA = 1.2
const STEP_MIN_GAP_MS = 300
const PAUSE_GAP_MS = 1200
const WINDOW_MS = 1000
const WINDOW_STEP_THRESHOLD = 2
const STEP_HEIGHT_METERS = 0.17
const FLOOR_HEIGHT_METERS = 3
const DEFAULT_SENSOR_INTERVAL: MotionInterval = 'game'

export async function startStairSensorCapture(
  input: StartStairSensorCaptureInput
): Promise<StairSensorCaptureSession> {
  const motionSensor = resolveUniMotionSensor()
  if (
    !motionSensor.startAccelerometer ||
    !motionSensor.startGyroscope ||
    !motionSensor.onAccelerometerChange ||
    !motionSensor.onGyroscopeChange
  ) {
    throw new Error('Motion sensor APIs are unavailable.')
  }
  const startedAtMs = Date.now()
  const samples: SensorSample[] = []
  let latestGyroscope: GyroscopeSample | null = null
  let isActive = true
  let stopPromise: Promise<StairSensorCaptureResult> | null = null
  let stoppedResult: StairSensorCaptureResult | null = null

  const accelerometerHandler = (result: MotionVector) => {
    if (!isActive) {
      return
    }

    samples.push({
      timestampMs: Date.now(),
      acceleration: {
        x: result.x,
        y: result.y,
        z: result.z
      }
    })
  }

  const gyroscopeHandler = (result: MotionVector) => {
    if (!isActive) {
      return
    }

    latestGyroscope = {
      timestampMs: Date.now(),
      rotationRate: {
        x: result.x,
        y: result.y,
        z: result.z
      }
    }
  }

  motionSensor.onAccelerometerChange?.(accelerometerHandler)
  motionSensor.onGyroscopeChange?.(gyroscopeHandler)

  try {
    await Promise.all([
      callUniSensorMethod(callbacks =>
        motionSensor.startAccelerometer?.({
          interval: input.accelerometerInterval ?? DEFAULT_SENSOR_INTERVAL,
          ...callbacks
        }),
        'callback'
      ),
      callUniSensorMethod(callbacks =>
        motionSensor.startGyroscope?.({
          interval: input.gyroscopeInterval ?? DEFAULT_SENSOR_INTERVAL,
          ...callbacks
        }),
        'callback'
      )
    ])
  } catch (error) {
    isActive = false
    motionSensor.offAccelerometerChange?.(accelerometerHandler)
    motionSensor.offGyroscopeChange?.(gyroscopeHandler)
    callUniSensorMethod(callbacks => motionSensor.stopAccelerometer?.(callbacks), 'callback')
      .catch(() => {})
    callUniSensorMethod(callbacks => motionSensor.stopGyroscope?.(callbacks), 'callback')
      .catch(() => {})
    throw error
  }

  const buildSnapshot = (snapshotInput?: StopStairSensorCaptureInput): StairSensorCaptureSnapshot => {
    const analysis = createSensorSessionAnalysis({
      durationSeconds: snapshotInput?.durationSeconds,
      completedIntervals: snapshotInput?.completedIntervals ?? input.completedIntervals,
      samples
    })

    return {
      startedAtMs,
      samples: [...samples],
      latestGyroscope: latestGyroscope
        ? {
            timestampMs: latestGyroscope.timestampMs,
            rotationRate: { ...latestGyroscope.rotationRate }
          }
        : null,
      analysis
    }
  }

  return {
    getSnapshot(snapshotInput) {
      return buildSnapshot(snapshotInput)
    },
    async stop(stopInput) {
      if (stoppedResult) {
        return stoppedResult
      }

      if (stopPromise) {
        return stopPromise
      }

      stopPromise = (async () => {
        isActive = false

        motionSensor.offAccelerometerChange?.(accelerometerHandler)
        motionSensor.offGyroscopeChange?.(gyroscopeHandler)

        await Promise.all([
          callUniSensorMethod(callbacks => motionSensor.stopAccelerometer?.(callbacks), 'callback'),
          callUniSensorMethod(callbacks => motionSensor.stopGyroscope?.(callbacks), 'callback')
        ])

        stoppedResult = buildSnapshot(stopInput)
        return stoppedResult
      })()

      return stopPromise
    }
  }
}

export function createSensorSessionAnalysis(input: SensorAnalysisInput): SensorSessionAnalysis {
  const samples = normalizeSamples(input.samples ?? [])
  const durationSeconds = resolveDurationSeconds(input.durationSeconds, samples)
  const peakTimestampsMs = detectStepPeakTimestamps(samples)
  const estimatedStepCount = peakTimestampsMs.length
  const stepIntervalsMs = measureIntervalsMs(peakTimestampsMs)
  const cadenceSpmAvg = durationSeconds > 0 ? roundNumber((estimatedStepCount / durationSeconds) * 60, 1) : 0
  const cadenceSpmPeak = roundNumber(computePeakCadenceSpm(peakTimestampsMs), 1)
  const cadenceStability = roundNumber(computeCadenceStability(stepIntervalsMs), 2)
  const pauseCount = countPauses(stepIntervalsMs)
  const activeClimbSeconds = roundNumber(computeActiveClimbSeconds(peakTimestampsMs), 1)
  const verticalDistanceMeters = roundNumber(estimatedStepCount * STEP_HEIGHT_METERS, 2)
  const estimatedVerticalSpeedMps =
    activeClimbSeconds > 0 ? roundNumber(verticalDistanceMeters / activeClimbSeconds, 2) : 0
  const estimatedFloorsPerMin =
    durationSeconds > 0
      ? roundNumber((verticalDistanceMeters / FLOOR_HEIGHT_METERS) / (durationSeconds / 60), 2)
      : 0
  const confidence = roundNumber(computeConfidence({
    samples,
    estimatedStepCount,
    cadenceStability,
    pauseCount,
    completedIntervals: input.completedIntervals
  }), 2)
  const qualityScore = Math.round(computeQualityScore({
    cadenceStability,
    pauseCount,
    estimatedStepCount,
    durationSeconds,
    completedIntervals: input.completedIntervals,
    confidence
  }))

  return {
    qualityScore,
    summary: buildSummary({
      qualityScore,
      estimatedStepCount,
      cadenceStability,
      pauseCount,
      activeClimbSeconds,
      confidence
    }),
    capturedBy: 'sensor',
    estimatedStepCount,
    activeClimbSeconds,
    cadenceSpmAvg,
    cadenceSpmPeak,
    cadenceStability,
    estimatedVerticalSpeedMps,
    estimatedFloorsPerMin,
    pauseCount,
    confidence,
    completedIntervals: input.completedIntervals,
    durationSeconds
  }
}

function normalizeSamples(samples: SensorSample[]): SensorSample[] {
  return [...samples].sort((left, right) => left.timestampMs - right.timestampMs)
}

function resolveDurationSeconds(durationSeconds: number | undefined, samples: SensorSample[]) {
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    return durationSeconds
  }

  if (samples.length < 2) {
    return 0
  }

  return roundNumber((samples[samples.length - 1]!.timestampMs - samples[0]!.timestampMs) / 1000, 1)
}

function detectStepPeakTimestamps(samples: SensorSample[]) {
  if (samples.length < 3) {
    return [] as number[]
  }

  const magnitudes = samples.map(sample => magnitude(sample.acceleration))
  const peakTimestampsMs: number[] = []

  for (let index = 1; index < samples.length - 1; index += 1) {
    const currentMagnitude = magnitudes[index]!
    const previousMagnitude = magnitudes[index - 1]!
    const nextMagnitude = magnitudes[index + 1]!

    if (currentMagnitude < GRAVITY_BASELINE + STEP_PEAK_DELTA) {
      continue
    }

    if (currentMagnitude <= previousMagnitude || currentMagnitude < nextMagnitude) {
      continue
    }

    const timestampMs = samples[index]!.timestampMs
    const lastAcceptedTimestampMs = peakTimestampsMs[peakTimestampsMs.length - 1]

    if (
      typeof lastAcceptedTimestampMs === 'number' &&
      timestampMs - lastAcceptedTimestampMs < STEP_MIN_GAP_MS
    ) {
      if (currentMagnitude > magnitude(samples[index - 1]!.acceleration)) {
        peakTimestampsMs[peakTimestampsMs.length - 1] = timestampMs
      }
      continue
    }

    peakTimestampsMs.push(timestampMs)
  }

  return peakTimestampsMs
}

function magnitude(acceleration: SensorSample['acceleration']) {
  return Math.sqrt(
    acceleration.x * acceleration.x +
      acceleration.y * acceleration.y +
      acceleration.z * acceleration.z
  )
}

function measureIntervalsMs(timestampsMs: number[]) {
  const intervalsMs: number[] = []

  for (let index = 1; index < timestampsMs.length; index += 1) {
    intervalsMs.push(timestampsMs[index]! - timestampsMs[index - 1]!)
  }

  return intervalsMs
}

function computePeakCadenceSpm(timestampsMs: number[]) {
  if (timestampsMs.length === 0) {
    return 0
  }

  return timestampsMs.reduce((peak, timestampMs) => {
    const windowStartMs = timestampMs - WINDOW_MS
    const windowStepCount = timestampsMs.filter(value => value > windowStartMs && value <= timestampMs).length

    if (windowStepCount < WINDOW_STEP_THRESHOLD) {
      return peak
    }

    return Math.max(peak, windowStepCount * 60)
  }, 0)
}

function computeCadenceStability(intervalsMs: number[]) {
  if (intervalsMs.length === 0) {
    return 0
  }

  const meanIntervalMs = average(intervalsMs)

  if (meanIntervalMs <= 0) {
    return 0
  }

  const variance = average(intervalsMs.map(intervalMs => (intervalMs - meanIntervalMs) ** 2))
  const coefficientOfVariation = Math.sqrt(variance) / meanIntervalMs

  return clamp(1 - coefficientOfVariation * 1.5, 0, 1)
}

function countPauses(intervalsMs: number[]) {
  return intervalsMs.filter(intervalMs => intervalMs >= PAUSE_GAP_MS).length
}

function computeActiveClimbSeconds(timestampsMs: number[]) {
  if (timestampsMs.length < 2) {
    return 0
  }

  const activeIntervalsMs = measureIntervalsMs(timestampsMs)
    .filter(intervalMs => intervalMs < PAUSE_GAP_MS)
    .reduce((total, intervalMs) => total + intervalMs, 0)

  return activeIntervalsMs > 0 ? activeIntervalsMs / 1000 : 0
}

function computeConfidence(input: {
  samples: SensorSample[]
  estimatedStepCount: number
  cadenceStability: number
  pauseCount: number
  completedIntervals: number
}) {
  if (input.samples.length === 0) {
    return clamp(0.35 + input.completedIntervals * 0.12, 0, 0.72)
  }

  const sampleCoverage = clamp(input.samples.length / 30, 0, 1)
  const stepCoverage = clamp(input.estimatedStepCount / 6, 0, 1)
  const stabilityScore = input.cadenceStability
  const pausePenalty = Math.min(0.18, input.pauseCount * 0.12)
  const intervalBonus = Math.min(0.12, input.completedIntervals * 0.05)

  return clamp(0.28 + sampleCoverage * 0.24 + stepCoverage * 0.22 + stabilityScore * 0.26 + intervalBonus - pausePenalty, 0, 1)
}

function computeQualityScore(input: {
  cadenceStability: number
  pauseCount: number
  estimatedStepCount: number
  durationSeconds: number
  completedIntervals: number
  confidence: number
}) {
  if (input.estimatedStepCount === 0) {
    return clamp(18 + input.completedIntervals * 8 + input.confidence * 20, 0, 42)
  }

  const cadenceScore = clamp(input.cadenceStability * 42, 0, 42)
  const volumeScore = clamp(input.estimatedStepCount * 4.5, 0, 22)
  const intervalScore = clamp(input.completedIntervals * 8, 0, 16)
  const durationScore = clamp(input.durationSeconds * 0.7, 0, 10)
  const confidenceScore = clamp(input.confidence * 14, 0, 14)
  const pausePenalty = Math.min(18, input.pauseCount * 10)

  return clamp(16 + cadenceScore + volumeScore + intervalScore + durationScore + confidenceScore - pausePenalty, 0, 100)
}

function buildSummary(input: {
  qualityScore: number
  estimatedStepCount: number
  cadenceStability: number
  pauseCount: number
  activeClimbSeconds: number
  confidence: number
}) {
  if (input.estimatedStepCount === 0 || input.activeClimbSeconds === 0) {
    return '本次传感器检测到的动作偏少，楼梯节奏尚未形成，建议开始后连续抬腿并保持上楼动作。'
  }

  const rhythmClause =
    input.cadenceStability >= 0.78 ? '节奏稳定' : input.cadenceStability >= 0.55 ? '节奏基本连续' : '节奏波动较明显'
  const pauseClause =
    input.pauseCount === 0 ? '全程几乎没有停顿' : `中途出现 ${input.pauseCount} 次明显停顿`
  const confidenceClause =
    input.confidence >= 0.75 ? '本次识别把握较高。' : input.confidence >= 0.5 ? '本次识别基本可信。' : '本次识别把握一般，建议补充更连续的样本。'

  if (input.qualityScore >= 80) {
    return `本次楼梯训练${rhythmClause}，${pauseClause}。传感器采集很稳定，下一轮可以尝试把抬膝再提高一些。${confidenceClause}`
  }

  if (input.qualityScore >= 55) {
    return `本次楼梯训练${rhythmClause}，但${pauseClause}，建议下一轮尽量减少停顿并保持连续发力。${confidenceClause}`
  }

  return `本次楼梯训练节奏建立不足，${pauseClause}，建议缩短中断时间并尽快恢复连续上楼动作。${confidenceClause}`
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundNumber(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function resolveUniMotionSensor(): UniMotionSensor {
  if (typeof globalThis === 'undefined') {
    return {}
  }

  const runtime = globalThis as typeof globalThis & {
    uni?: unknown
  }

  return runtime.uni ? (runtime.uni as UniMotionSensor) : {}
}

async function callUniSensorMethod(
  invoke: (callbacks: SensorMethodOptions) => unknown,
  methodKind: SensorMethodKind = 'promise'
) {
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const settle = (action: 'resolve' | 'reject', error?: unknown) => {
      if (settled) {
        return
      }
      settled = true
      if (action === 'resolve') {
        resolve()
        return
      }
      reject(toSensorError(error))
    }

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
      return
    }

    if (methodKind === 'promise') {
      settle('resolve')
    }
  })
}

function toSensorError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  if (error && typeof error === 'object') {
    const message = (error as { errMsg?: unknown }).errMsg
    if (typeof message === 'string' && message.trim()) {
      return new Error(message)
    }
  }

  return new Error('Motion sensor operation failed.')
}
