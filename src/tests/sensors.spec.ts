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

  it('degrades safely when uni motion sensor APIs are unavailable', async () => {
    vi.stubGlobal('uni', {})
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(3000)

    await expect(startStairSensorCapture({
      completedIntervals: 0
    })).rejects.toThrow('Motion sensor APIs are unavailable.')

    nowSpy.mockRestore()
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
