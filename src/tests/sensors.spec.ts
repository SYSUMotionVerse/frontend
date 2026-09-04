import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createSensorSessionAnalysis,
  startStairSensorCapture,
  type SensorSample,
  type SensorSessionAnalysis
} from '../uni-app/platform/sensors'

function createStableClimbSamples(): SensorSample[] {
  const baseMagnitude = 9.81
  const stepTimesMs = [400, 900, 1400, 1900, 2400, 2900, 3400]

  return Array.from({ length: 41 }, (_, index) => {
    const timestampMs = index * 100
    const hasStepPeak = stepTimesMs.some(stepTimeMs => Math.abs(stepTimeMs - timestampMs) <= 100)
    const magnitude = hasStepPeak ? baseMagnitude + 3.4 : baseMagnitude + (index % 2 === 0 ? 0.16 : -0.14)

    return {
      timestampMs,
      acceleration: {
        x: magnitude,
        y: 0,
        z: 0
      }
    }
  })
}

function createPausedClimbSamples(): SensorSample[] {
  const baseMagnitude = 9.81
  const stepTimesMs = [400, 900, 1400, 1900, 3300, 3800, 4300]

  return Array.from({ length: 46 }, (_, index) => {
    const timestampMs = index * 100
    const hasStepPeak = stepTimesMs.some(stepTimeMs => Math.abs(stepTimeMs - timestampMs) <= 100)
    const magnitude = hasStepPeak ? baseMagnitude + 3.2 : baseMagnitude + (index % 2 === 0 ? 0.12 : -0.1)

    return {
      timestampMs,
      acceleration: {
        x: magnitude,
        y: 0,
        z: 0
      }
    }
  })
}

function createModerateClimbSamples(baseMagnitude: number): SensorSample[] {
  const stepTimesMs = [400, 900, 1400, 1900, 2400, 2900, 3400]
  const peakMagnitude = baseMagnitude * 1.06

  return Array.from({ length: 41 }, (_, index) => {
    const timestampMs = index * 100
    const hasStepPeak = stepTimesMs.some(stepTimeMs => Math.abs(stepTimeMs - timestampMs) <= 100)
    const magnitude = hasStepPeak ? peakMagnitude : baseMagnitude + (index % 2 === 0 ? 0.01 : -0.01)

    return {
      timestampMs,
      acceleration: {
        x: magnitude,
        y: 0,
        z: 0
      }
    }
  })
}

function createBaselineShiftSamples(): SensorSample[] {
  const stepTimesMs = [400, 900, 1400, 1900, 2400, 2900, 3400]
  const initialSamples = Array.from({ length: 41 }, (_, index) => {
    const timestampMs = index * 100
    const hasStepPeak = stepTimesMs.some(stepTimeMs => Math.abs(stepTimeMs - timestampMs) <= 100)
    return {
      timestampMs,
      acceleration: { x: hasStepPeak ? 10.4 : 9.81, y: 0, z: 0 }
    }
  })
  const laterSamples = Array.from({ length: 60 }, (_, index) => ({
    timestampMs: 4_100 + index * 100,
    acceleration: { x: 10.2, y: 0, z: 0 }
  }))

  return [...initialSamples, ...laterSamples]
}

function createGappedClimbSamples(): SensorSample[] {
  const stepTimesMs = Array.from({ length: 25 }, (_, index) => 400 + index * 500)
  const activeSamples = Array.from({ length: 131 }, (_, index) => {
    const timestampMs = index * 100
    const hasStepPeak = stepTimesMs.some(stepTimeMs => Math.abs(stepTimeMs - timestampMs) <= 100)
    return {
      timestampMs,
      acceleration: { x: hasStepPeak ? 13.2 : 9.81, y: 0, z: 0 }
    }
  })

  return [...activeSamples, {
    timestampMs: 30_000,
    acceleration: { x: 9.81, y: 0, z: 0 }
  }]
}

function createClosePeakSamples(): SensorSample[] {
  const peakMagnitudes = new Map([
    [400, 14],
    [600, 12],
    [900, 14],
    [1400, 14],
    [1900, 14]
  ])

  return Array.from({ length: 23 }, (_, index) => {
    const timestampMs = index * 100
    return {
      timestampMs,
      acceleration: {
        x: peakMagnitudes.get(timestampMs) ?? 9.81,
        y: 0,
        z: 0
      }
    }
  })
}

function createStationaryJitterSamples(): SensorSample[] {
  const magnitudes = [9.81, 9.96, 9.72, 10.12, 9.58, 10.18, 9.74, 9.99, 9.67, 10.08]

  return Array.from({ length: 61 }, (_, index) => ({
    timestampMs: index * 100,
    acceleration: {
      x: magnitudes[index % magnitudes.length]!,
      y: 0,
      z: 0
    }
  }))
}

function createStaticSamples(durationMs: number): SensorSample[] {
  return Array.from({ length: durationMs / 100 + 1 }, (_, index) => ({
    timestampMs: index * 100,
    acceleration: {
      x: 9.81,
      y: 0,
      z: 0
    }
  }))
}

function assertSessionAnalysisShape(analysis: SensorSessionAnalysis) {
  expect(analysis.capturedBy).toBe('sensor')
  expect(analysis.qualityScore).toBeGreaterThanOrEqual(0)
  expect(analysis.qualityScore).toBeLessThanOrEqual(100)
  expect(analysis.confidence).toBeGreaterThanOrEqual(0)
  expect(analysis.confidence).toBeLessThanOrEqual(1)
}

interface UniSensorMock {
  emitAcceleration(sample: { x: number; y: number; z: number }): void
  emitGyroscope(sample: { x: number; y: number; z: number }): void
  startAccelerometer: ReturnType<typeof vi.fn>
  stopAccelerometer: ReturnType<typeof vi.fn>
  onAccelerometerChange: ReturnType<typeof vi.fn>
  offAccelerometerChange: ReturnType<typeof vi.fn>
  startGyroscope: ReturnType<typeof vi.fn>
  stopGyroscope: ReturnType<typeof vi.fn>
  onGyroscopeChange: ReturnType<typeof vi.fn>
  offGyroscopeChange: ReturnType<typeof vi.fn>
}

function installUniSensorMock(): UniSensorMock {
  let accelerometerHandler: ((sample: { x: number; y: number; z: number }) => void) | null = null
  let gyroscopeHandler: ((sample: { x: number; y: number; z: number }) => void) | null = null

  const mock: UniSensorMock = {
    startAccelerometer: vi.fn(() => Promise.resolve()),
    stopAccelerometer: vi.fn(() => Promise.resolve()),
    onAccelerometerChange: vi.fn((handler: (sample: { x: number; y: number; z: number }) => void) => {
      accelerometerHandler = handler
    }),
    offAccelerometerChange: vi.fn((handler?: (sample: { x: number; y: number; z: number }) => void) => {
      if (!handler || handler === accelerometerHandler) {
        accelerometerHandler = null
      }
    }),
    startGyroscope: vi.fn(() => Promise.resolve()),
    stopGyroscope: vi.fn(() => Promise.resolve()),
    onGyroscopeChange: vi.fn((handler: (sample: { x: number; y: number; z: number }) => void) => {
      gyroscopeHandler = handler
    }),
    offGyroscopeChange: vi.fn((handler?: (sample: { x: number; y: number; z: number }) => void) => {
      if (!handler || handler === gyroscopeHandler) {
        gyroscopeHandler = null
      }
    }),
    emitAcceleration(sample) {
      accelerometerHandler?.(sample)
    },
    emitGyroscope(sample) {
      gyroscopeHandler?.(sample)
    }
  }

  vi.stubGlobal('uni', mock)

  return mock
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createSensorSessionAnalysis', () => {
  it('classifies static samples as low-activity with zero steps', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createStaticSamples(4000),
      completedIntervals: 0
    })

    assertSessionAnalysisShape(analysis)
    expect(analysis.estimatedStepCount).toBe(0)
    expect(analysis.activeClimbSeconds).toBe(0)
    expect(analysis.pauseCount).toBe(0)
    expect(analysis.cadenceSpmAvg).toBe(0)
    expect(analysis.estimatedVerticalSpeedMps).toBe(0)
    expect(analysis.summary).toContain('动作偏少')
    expect(analysis.qualityScore).toBeLessThan(45)
  })

  it('does not turn stationary sensor jitter into steps', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createStationaryJitterSamples(),
      completedIntervals: 0
    })

    expect(analysis.estimatedStepCount).toBe(0)
    expect(analysis.activeClimbSeconds).toBe(0)
  })

  it('rejects an isolated motion spike without a step cadence', () => {
    const samples = createStaticSamples(3000).map(sample =>
      sample.timestampMs === 1000
        ? {
            ...sample,
            acceleration: { x: 14, y: 0, z: 0 }
          }
        : sample
    )
    const analysis = createSensorSessionAnalysis({
      samples,
      completedIntervals: 0
    })

    expect(analysis.estimatedStepCount).toBe(0)
  })

  it('recognizes a stable climb pattern with high cadence stability', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createStableClimbSamples(),
      completedIntervals: 2
    })

    assertSessionAnalysisShape(analysis)
    expect(analysis.completedIntervals).toBe(2)
    expect(analysis.estimatedStepCount).toBe(7)
    expect(analysis.activeClimbSeconds).toBeGreaterThanOrEqual(3)
    expect(analysis.cadenceSpmAvg).toBeGreaterThanOrEqual(90)
    expect(analysis.cadenceSpmPeak).toBeGreaterThanOrEqual(100)
    expect(analysis.cadenceStability).toBeGreaterThan(0.75)
    expect(analysis.pauseCount).toBe(0)
    expect(analysis.confidence).toBeGreaterThan(0.7)
    expect(analysis.summary).toContain('节奏稳定')
    expect(analysis.qualityScore).toBeGreaterThanOrEqual(75)
  })

  it('does not decrease confirmed steps when later samples shift the baseline', async () => {
    const uniMock = installUniSensorMock()
    const samples = createBaselineShiftSamples()
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const session = await startStairSensorCapture({ completedIntervals: 0 })

    for (const sample of samples.slice(0, 41)) {
      now = sample.timestampMs
      uniMock.emitAcceleration(sample.acceleration)
    }
    const initialAnalysis = session.getSnapshot().analysis

    for (const sample of samples.slice(41)) {
      now = sample.timestampMs
      uniMock.emitAcceleration(sample.acceleration)
    }
    const laterAnalysis = session.getSnapshot().analysis

    expect(initialAnalysis.estimatedStepCount).toBeGreaterThan(0)
    expect(laterAnalysis.estimatedStepCount).toBeGreaterThanOrEqual(
      initialAnalysis.estimatedStepCount
    )
  })

  it('withholds completion credit when a 30-second session lacks sensor coverage', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createStableClimbSamples(),
      durationSeconds: 30,
      completedIntervals: 1
    })

    expect(analysis.sensorCoverage).toBeLessThan(0.2)
    expect(analysis.isEligibleForCompletion).toBe(false)
    expect(analysis.completedIntervals).toBe(0)
    expect(analysis.qualityScore).toBeLessThanOrEqual(40)
  })

  it('withholds completion credit when sensor samples contain a long gap', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createGappedClimbSamples(),
      durationSeconds: 30,
      completedIntervals: 1
    })

    expect(analysis.sensorCoverage).toBeLessThan(0.5)
    expect(analysis.isEligibleForCompletion).toBe(false)
  })

  it('keeps the stronger peak when two candidates are too close together', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createClosePeakSamples(),
      completedIntervals: 1
    })

    expect(analysis.estimatedStepCount).toBe(4)
    expect(analysis.provisionalCadenceSpm).toBe(120)
  })

  it('reports provisional cadence before final step confirmation', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createStableClimbSamples().filter(sample => sample.timestampMs <= 1200),
      completedIntervals: 0
    })

    expect(analysis.estimatedStepCount).toBe(0)
    expect(analysis.cadenceSpmAvg).toBe(0)
    expect(analysis.provisionalCadenceSpm).toBe(120)
  })

  it('detects moderate peaks across acceleration unit scales', () => {
    for (const baseMagnitude of [9.81, 1]) {
      const analysis = createSensorSessionAnalysis({
        samples: createModerateClimbSamples(baseMagnitude),
        completedIntervals: 1
      })

      expect(analysis.estimatedStepCount, `base=${baseMagnitude}`).toBe(7)
    }
  })

  it('detects a pause inside a climb session and lowers stability', () => {
    const analysis = createSensorSessionAnalysis({
      samples: createPausedClimbSamples(),
      completedIntervals: 2
    })

    assertSessionAnalysisShape(analysis)
    expect(analysis.estimatedStepCount).toBe(7)
    expect(analysis.pauseCount).toBeGreaterThanOrEqual(1)
    expect(analysis.cadenceStability).toBeLessThan(0.7)
    expect(analysis.activeClimbSeconds).toBeLessThan(analysis.durationSeconds)
    expect(analysis.summary).toContain('停顿')
    expect(analysis.qualityScore).toBeLessThan(80)
  })
})

describe('startStairSensorCapture', () => {
  it('starts accelerometer and gyroscope capture, exposes live snapshot, and returns final analysis on stop', async () => {
    const uniMock = installUniSensorMock()
    const nowSpy = vi.spyOn(Date, 'now')

    nowSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1100)
      .mockReturnValueOnce(1200)
      .mockReturnValueOnce(1500)
      .mockReturnValueOnce(1800)

    const session = await startStairSensorCapture({
      completedIntervals: 2
    })

    expect(uniMock.startAccelerometer).toHaveBeenCalledWith(expect.objectContaining({ interval: 'game' }))
    expect(uniMock.startGyroscope).toHaveBeenCalledWith(expect.objectContaining({ interval: 'game' }))

    uniMock.emitGyroscope({ x: 0.12, y: 0.21, z: 0.31 })
    uniMock.emitAcceleration({ x: 13.3, y: 0, z: 0 })
    uniMock.emitAcceleration({ x: 9.81, y: 0.08, z: -0.02 })
    uniMock.emitGyroscope({ x: 0.16, y: 0.28, z: 0.11 })

    const snapshot = session.getSnapshot()

    expect(snapshot.samples).toHaveLength(2)
    expect(snapshot.latestGyroscope).toEqual({
      timestampMs: 1800,
      rotationRate: { x: 0.16, y: 0.28, z: 0.11 }
    })
    expect(snapshot.analysis.completedIntervals).toBe(2)
    expect(snapshot.analysis.durationSeconds).toBe(0.3)

    const result = await session.stop({
      completedIntervals: 3
    })

    expect(result.samples).toHaveLength(2)
    expect(result.analysis.completedIntervals).toBe(3)
    expect(result.analysis.durationSeconds).toBe(0.3)
    expect(uniMock.offAccelerometerChange).toHaveBeenCalledTimes(1)
    expect(uniMock.offGyroscopeChange).toHaveBeenCalledTimes(1)
    expect(uniMock.stopAccelerometer).toHaveBeenCalledTimes(1)
    expect(uniMock.stopGyroscope).toHaveBeenCalledTimes(1)

    nowSpy.mockRestore()
  })

  it('keeps stop idempotent and ignores sensor events after cleanup', async () => {
    const uniMock = installUniSensorMock()
    const nowSpy = vi.spyOn(Date, 'now')

    nowSpy
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2100)
      .mockReturnValueOnce(2400)

    const session = await startStairSensorCapture({
      completedIntervals: 1
    })

    uniMock.emitAcceleration({ x: 13.2, y: 0, z: 0 })

    const firstStop = await session.stop()
    uniMock.emitAcceleration({ x: 14, y: 0, z: 0 })
    const secondStop = await session.stop()

    expect(firstStop.samples).toHaveLength(1)
    expect(secondStop).toEqual(firstStop)
    expect(uniMock.stopAccelerometer).toHaveBeenCalledTimes(1)
    expect(uniMock.stopGyroscope).toHaveBeenCalledTimes(1)

    nowSpy.mockRestore()
  })

  it('captures stairs when gyroscope APIs are unavailable', async () => {
    const capturedHandlers: {
      accelerometer: ((sample: { x: number; y: number; z: number }) => void) | null
    } = {
      accelerometer: null
    }
    const uniMock = {
      startAccelerometer: vi.fn((options: { success?: () => void }) => options.success?.()),
      stopAccelerometer: vi.fn((options: { success?: () => void }) => options.success?.()),
      onAccelerometerChange: vi.fn((handler: typeof capturedHandlers.accelerometer) => {
        capturedHandlers.accelerometer = handler
      }),
      offAccelerometerChange: vi.fn(() => {
        capturedHandlers.accelerometer = null
      })
    }
    vi.stubGlobal('uni', uniMock)

    const session = await startStairSensorCapture({ completedIntervals: 0 })

    capturedHandlers.accelerometer?.({ x: 13.2, y: 0, z: 0 })
    const result = await session.stop()

    expect(result.samples).toHaveLength(1)
    expect(result.latestGyroscope).toBeNull()
    expect(uniMock.startAccelerometer).toHaveBeenCalledTimes(1)
    expect(uniMock.stopAccelerometer).toHaveBeenCalledTimes(1)
  })

  it('degrades safely when uni motion sensor APIs are unavailable', async () => {
    vi.stubGlobal('uni', {})
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(3000)

    await expect(startStairSensorCapture({
      completedIntervals: 0
    })).rejects.toThrow('Motion sensor APIs are unavailable.')

    nowSpy.mockRestore()
  })

  it('times out a sensor start that never settles and cleans up listeners', async () => {
    vi.useFakeTimers()
    const uniMock = {
      startAccelerometer: vi.fn(),
      stopAccelerometer: vi.fn((options: { success?: () => void }) => options.success?.()),
      onAccelerometerChange: vi.fn(),
      offAccelerometerChange: vi.fn(),
      startGyroscope: vi.fn(),
      stopGyroscope: vi.fn((options: { success?: () => void }) => options.success?.()),
      onGyroscopeChange: vi.fn(),
      offGyroscopeChange: vi.fn()
    }
    vi.stubGlobal('uni', uniMock)

    const capture = startStairSensorCapture({ completedIntervals: 0 })
    const timedOut = expect(capture).rejects.toThrow('Motion sensor startup timed out.')

    await vi.advanceTimersByTimeAsync(5_000)

    await timedOut
    expect(uniMock.offAccelerometerChange).toHaveBeenCalledTimes(1)
    expect(uniMock.offGyroscopeChange).toHaveBeenCalledTimes(1)
    expect(uniMock.stopAccelerometer).toHaveBeenCalledTimes(1)
    expect(uniMock.stopGyroscope).toHaveBeenCalledTimes(1)
  })

  it('times out a sensor stop that never settles after cleanup', async () => {
    vi.useFakeTimers()
    const uniMock = installUniSensorMock()
    uniMock.stopAccelerometer.mockImplementation(() => undefined)
    uniMock.stopGyroscope.mockImplementation(() => undefined)

    const session = await startStairSensorCapture({ completedIntervals: 0 })
    const stop = expect(session.stop()).rejects.toThrow('Motion sensor shutdown timed out.')

    await vi.advanceTimersByTimeAsync(2_000)
    await stop

    expect(uniMock.offAccelerometerChange).toHaveBeenCalledTimes(1)
    expect(uniMock.offGyroscopeChange).toHaveBeenCalledTimes(1)
  })

  it('rejects when a callback-style sensor start reports failure and cleans up listeners', async () => {
    let accelerometerHandler: ((sample: { x: number; y: number; z: number }) => void) | null = null
    const uniMock = {
      startAccelerometer: vi.fn((options: { fail?: (error: unknown) => void }) => {
        options.fail?.({ errMsg: 'startAccelerometer:fail permission denied' })
      }),
      stopAccelerometer: vi.fn(),
      onAccelerometerChange: vi.fn((handler: typeof accelerometerHandler) => {
        accelerometerHandler = handler
      }),
      offAccelerometerChange: vi.fn(() => {
        accelerometerHandler = null
      }),
      startGyroscope: vi.fn((options: { success?: () => void }) => {
        options.success?.()
      }),
      stopGyroscope: vi.fn(),
      onGyroscopeChange: vi.fn(),
      offGyroscopeChange: vi.fn()
    }
    vi.stubGlobal('uni', uniMock)

    await expect(startStairSensorCapture({
      completedIntervals: 0
    })).rejects.toThrow('permission denied')

    expect(uniMock.offAccelerometerChange).toHaveBeenCalledTimes(1)
    expect(uniMock.offGyroscopeChange).toHaveBeenCalledTimes(1)
    expect(accelerometerHandler).toBeNull()
  })
})
