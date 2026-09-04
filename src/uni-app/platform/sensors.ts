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
  provisionalCadenceSpm: number
  cadenceSpmPeak: number
  cadenceStability: number
  estimatedVerticalSpeedMps: number
  estimatedFloorsPerMin: number
  pauseCount: number
  confidence: number
  sensorCoverage: number
  isEligibleForCompletion: boolean
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

const STEP_PEAK_RATIO = 0.05
const MIN_STEP_PEAK_DELTA = 0.05
const NOISE_CALIBRATION_WINDOW_MS = 500
const NOISE_MULTIPLIER = 3
const STEP_MIN_GAP_MS = 300
const STEP_MAX_GAP_MS = 1200
const MIN_CONSECUTIVE_STEPS = 3
const PAUSE_GAP_MS = 1200
const WINDOW_MS = 1000
const WINDOW_STEP_THRESHOLD = 2
const STEP_HEIGHT_METERS = 0.17
const FLOOR_HEIGHT_METERS = 3
const DEFAULT_SENSOR_INTERVAL: MotionInterval = 'game'
const SENSOR_START_TIMEOUT_MS = 5_000
const SENSOR_STOP_TIMEOUT_MS = 2_000
const COMPLETION_DURATION_SECONDS = 30
const MIN_SENSOR_COVERAGE_FOR_COMPLETION = 0.8
const MIN_STEPS_FOR_COMPLETION = 12
const MIN_ACTIVE_CLIMB_SECONDS_FOR_COMPLETION = 12
const MAX_SENSOR_SAMPLE_GAP_MS = 2_000

export async function startStairSensorCapture(
  input: StartStairSensorCaptureInput
): Promise<StairSensorCaptureSession> {
  const motionSensor = resolveUniMotionSensor()
  if (
    !motionSensor.startAccelerometer ||
    !motionSensor.stopAccelerometer ||
    !motionSensor.onAccelerometerChange
  ) {
    throw new Error('Motion sensor APIs are unavailable.')
  }
  const shouldCaptureGyroscope = Boolean(
    motionSensor.startGyroscope &&
    motionSensor.stopGyroscope &&
    motionSensor.onGyroscopeChange
  )
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

  motionSensor.onAccelerometerChange(accelerometerHandler)
  if (shouldCaptureGyroscope) {
    motionSensor.onGyroscopeChange?.(gyroscopeHandler)
  }

  try {
    const sensorStarts = [
      callUniSensorMethod(callbacks =>
        motionSensor.startAccelerometer?.({
          interval: input.accelerometerInterval ?? DEFAULT_SENSOR_INTERVAL,
          ...callbacks
        }),
        'callback',
        SENSOR_START_TIMEOUT_MS,
        'Motion sensor startup timed out.'
      )
    ]
    if (shouldCaptureGyroscope) {
      sensorStarts.push(
        callUniSensorMethod(callbacks =>
          motionSensor.startGyroscope?.({
            interval: input.gyroscopeInterval ?? DEFAULT_SENSOR_INTERVAL,
            ...callbacks
          }),
          'callback',
          SENSOR_START_TIMEOUT_MS,
          'Motion sensor startup timed out.'
        )
      )
    }
    await Promise.all(sensorStarts)
  } catch (error) {
    isActive = false
    motionSensor.offAccelerometerChange?.(accelerometerHandler)
    if (shouldCaptureGyroscope) {
      motionSensor.offGyroscopeChange?.(gyroscopeHandler)
    }
    callUniSensorMethod(
      callbacks => motionSensor.stopAccelerometer?.(callbacks),
      'callback',
      SENSOR_STOP_TIMEOUT_MS,
      'Motion sensor shutdown timed out.'
    ).catch(() => {})
    if (shouldCaptureGyroscope) {
      callUniSensorMethod(
        callbacks => motionSensor.stopGyroscope?.(callbacks),
        'callback',
        SENSOR_STOP_TIMEOUT_MS,
        'Motion sensor shutdown timed out.'
      ).catch(() => {})
    }
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
        if (shouldCaptureGyroscope) {
          motionSensor.offGyroscopeChange?.(gyroscopeHandler)
        }

        const sensorStops = [
          callUniSensorMethod(
            callbacks => motionSensor.stopAccelerometer?.(callbacks),
            'callback',
            SENSOR_STOP_TIMEOUT_MS,
            'Motion sensor shutdown timed out.'
          )
        ]
        if (shouldCaptureGyroscope) {
          sensorStops.push(
            callUniSensorMethod(
              callbacks => motionSensor.stopGyroscope?.(callbacks),
              'callback',
              SENSOR_STOP_TIMEOUT_MS,
              'Motion sensor shutdown timed out.'
            )
          )
        }
        await Promise.all(sensorStops)

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
  const candidateStepPeakTimestampsMs = detectStepPeakTimestamps(samples)
  const peakTimestampsMs = keepCadencedStepSequences(candidateStepPeakTimestampsMs)
  const estimatedStepCount = peakTimestampsMs.length
  const provisionalCadenceSpm = computeProvisionalCadenceSpm(candidateStepPeakTimestampsMs)
  const stepIntervalsMs = measureIntervalsMs(peakTimestampsMs)
  const cadenceSpmAvg = durationSeconds > 0 ? roundNumber((estimatedStepCount / durationSeconds) * 60, 1) : 0
  const cadenceSpmPeak = roundNumber(computePeakCadenceSpm(peakTimestampsMs), 1)
  const cadenceStability = roundNumber(computeCadenceStability(stepIntervalsMs), 2)
  const pauseCount = countPauses(stepIntervalsMs)
  const activeClimbSeconds = roundNumber(computeActiveClimbSeconds(peakTimestampsMs), 1)
  const sensorCoverage = computeSensorCoverage(samples, durationSeconds)
  const requiresFullSessionEvidence = durationSeconds >= COMPLETION_DURATION_SECONDS
  const isEligibleForCompletion = input.completedIntervals > 0 && (
    !requiresFullSessionEvidence || (
      sensorCoverage >= MIN_SENSOR_COVERAGE_FOR_COMPLETION &&
      estimatedStepCount >= MIN_STEPS_FOR_COMPLETION &&
      activeClimbSeconds >= MIN_ACTIVE_CLIMB_SECONDS_FOR_COMPLETION
    )
  )
  const completedIntervals = isEligibleForCompletion ? input.completedIntervals : 0
  const verticalDistanceMeters = roundNumber(estimatedStepCount * STEP_HEIGHT_METERS, 2)
  const estimatedVerticalSpeedMps =
    activeClimbSeconds > 0 ? roundNumber(verticalDistanceMeters / activeClimbSeconds, 2) : 0
  const estimatedFloorsPerMin =
    durationSeconds > 0
      ? roundNumber((verticalDistanceMeters / FLOOR_HEIGHT_METERS) / (durationSeconds / 60), 2)
      : 0
  const confidence = roundNumber(computeConfidence({
    sensorCoverage,
    estimatedStepCount,
    cadenceStability,
    pauseCount,
    completedIntervals
  }), 2)
  const rawQualityScore = Math.round(computeQualityScore({
    cadenceStability,
    pauseCount,
    estimatedStepCount,
    durationSeconds,
    completedIntervals,
    confidence
  }))
  const qualityScore = isEligibleForCompletion
    ? rawQualityScore
    : Math.min(rawQualityScore, 40)

  return {
    qualityScore,
    summary: buildSummary({
      qualityScore,
      estimatedStepCount,
      cadenceStability,
      pauseCount,
      activeClimbSeconds,
      confidence,
      isEligibleForCompletion,
      completionAttempted: input.completedIntervals > 0
    }),
    capturedBy: 'sensor',
    estimatedStepCount,
    activeClimbSeconds,
    cadenceSpmAvg,
    provisionalCadenceSpm,
    cadenceSpmPeak,
    cadenceStability,
    estimatedVerticalSpeedMps,
    estimatedFloorsPerMin,
    pauseCount,
    confidence,
    sensorCoverage,
    isEligibleForCompletion,
    completedIntervals,
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
  const baselineMagnitude = lowerQuantile(magnitudes)
  const noiseCalibrationEndMs = samples[0]!.timestampMs + NOISE_CALIBRATION_WINDOW_MS
  const calibrationNoise = magnitudes
    .filter((_, index) => samples[index]!.timestampMs <= noiseCalibrationEndMs)
    .map(value => Math.abs(value - baselineMagnitude))
  const peakDelta = Math.max(
    MIN_STEP_PEAK_DELTA,
    baselineMagnitude * STEP_PEAK_RATIO,
    lowerQuantile(calibrationNoise) * NOISE_MULTIPLIER
  )
  const peakThreshold = baselineMagnitude + peakDelta
  const peakCandidates: Array<{ timestampMs: number; magnitude: number }> = []

  for (let index = 1; index < samples.length - 1; index += 1) {
    const currentMagnitude = magnitudes[index]!
    const previousMagnitude = magnitudes[index - 1]!
    const nextMagnitude = magnitudes[index + 1]!

    if (currentMagnitude < peakThreshold) {
      continue
    }

    if (currentMagnitude <= previousMagnitude || currentMagnitude < nextMagnitude) {
      continue
    }

    const timestampMs = samples[index]!.timestampMs
    const lastCandidate = peakCandidates[peakCandidates.length - 1]

    if (
      lastCandidate &&
      timestampMs - lastCandidate.timestampMs < STEP_MIN_GAP_MS
    ) {
      if (currentMagnitude > lastCandidate.magnitude) {
        peakCandidates[peakCandidates.length - 1] = {
          timestampMs,
          magnitude: currentMagnitude
        }
      }
      continue
    }

    peakCandidates.push({
      timestampMs,
      magnitude: currentMagnitude
    })
  }

  return peakCandidates.map(candidate => candidate.timestampMs)
}

function computeProvisionalCadenceSpm(timestampsMs: number[]) {
  const recentIntervalsMs: number[] = []

  for (let index = timestampsMs.length - 1; index > 0; index -= 1) {
    const intervalMs = timestampsMs[index]! - timestampsMs[index - 1]!
    if (intervalMs < STEP_MIN_GAP_MS || intervalMs > STEP_MAX_GAP_MS) {
      break
    }
    recentIntervalsMs.push(intervalMs)
    if (recentIntervalsMs.length === 3) {
      break
    }
  }

  return recentIntervalsMs.length > 0
    ? roundNumber(60_000 / average(recentIntervalsMs), 1)
    : 0
}

function keepCadencedStepSequences(timestampsMs: number[]) {
  const acceptedTimestamps: number[] = []
  let sequenceStartIndex = 0

  function acceptSequence(endIndex: number) {
    if (endIndex - sequenceStartIndex + 1 < MIN_CONSECUTIVE_STEPS) {
      return
    }

    acceptedTimestamps.push(...timestampsMs.slice(sequenceStartIndex, endIndex + 1))
  }

  for (let index = 1; index < timestampsMs.length; index += 1) {
    const intervalMs = timestampsMs[index]! - timestampsMs[index - 1]!
    if (intervalMs >= STEP_MIN_GAP_MS && intervalMs <= STEP_MAX_GAP_MS) {
      continue
    }

    acceptSequence(index - 1)
    sequenceStartIndex = index
  }

  acceptSequence(timestampsMs.length - 1)
  return acceptedTimestamps
}

function magnitude(acceleration: SensorSample['acceleration']) {
  return Math.sqrt(
    acceleration.x * acceleration.x +
      acceleration.y * acceleration.y +
      acceleration.z * acceleration.z
  )
}

function computeSensorCoverage(samples: SensorSample[], durationSeconds: number) {
  if (samples.length < 2) {
    return 0
  }

  if (durationSeconds <= 0) {
    return 1
  }

  const capturedDurationMs = samples.slice(1).reduce((total, sample, index) => {
    const previousSample = samples[index]!
    const gapMs = sample.timestampMs - previousSample.timestampMs
    return gapMs > 0 && gapMs <= MAX_SENSOR_SAMPLE_GAP_MS
      ? total + gapMs
      : total
  }, 0)
  return clamp(capturedDurationMs / (durationSeconds * 1000), 0, 1)
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
  sensorCoverage: number
  estimatedStepCount: number
  cadenceStability: number
  pauseCount: number
  completedIntervals: number
}) {
  if (input.sensorCoverage === 0) {
    return clamp(0.35 + input.completedIntervals * 0.12, 0, 0.72)
  }

  const sampleCoverage = input.sensorCoverage
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
  isEligibleForCompletion: boolean
  completionAttempted: boolean
}) {
  if (input.completionAttempted && !input.isEligibleForCompletion) {
    return '本轮传感器数据未覆盖足够的连续上楼动作，未计入训练完成；请保持手机稳定并连续上楼后重试。'
  }

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

function lowerQuantile(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sortedValues = [...values].sort((left, right) => left - right)
  const quantileIndex = Math.floor((sortedValues.length - 1) * 0.2)

  return sortedValues[quantileIndex]!
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundNumber(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function resolveUniMotionSensor(): UniMotionSensor {
  // Use uni-app's injected runtime binding instead of globalThis.uni. The
  // mp-weixin bundle exposes `uni` through its runtime bridge, but it is not
  // guaranteed to be attached as a property on globalThis.
  return typeof uni === 'undefined' ? {} : (uni as unknown as UniMotionSensor)
}

async function callUniSensorMethod(
  invoke: (callbacks: SensorMethodOptions) => unknown,
  methodKind: SensorMethodKind = 'promise',
  timeoutMs?: number,
  timeoutMessage = 'Motion sensor operation timed out.'
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
      reject(toSensorError(error))
    }

    if (methodKind === 'callback' && timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        settle('reject', new Error(timeoutMessage))
      }, timeoutMs)
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
