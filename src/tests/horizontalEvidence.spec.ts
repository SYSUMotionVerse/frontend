import { afterEach, describe, expect, it, vi } from 'vitest'
import { startHorizontalEvidenceCapture } from '../uni-app/platform/horizontalEvidence'

interface LocationMock {
  emit: (sample: { speed?: number; accuracy?: number }) => void
  startLocationUpdate: ReturnType<typeof vi.fn>
  stopLocationUpdate: ReturnType<typeof vi.fn>
  onLocationChange: ReturnType<typeof vi.fn>
  offLocationChange: ReturnType<typeof vi.fn>
}

function installLocationMock(): LocationMock {
  let handler: ((result: { speed?: number; accuracy?: number }) => void) | null = null
  const mock: LocationMock = {
    emit: sample => handler?.(sample),
    startLocationUpdate: vi.fn((options?: { success?: () => void }) => {
      options?.success?.()
    }),
    stopLocationUpdate: vi.fn((options?: { success?: () => void }) => {
      options?.success?.()
    }),
    onLocationChange: vi.fn((callback: typeof handler) => {
      handler = callback
    }),
    offLocationChange: vi.fn((callback?: typeof handler) => {
      if (!callback || callback === handler) {
        handler = null
      }
    })
  }

  vi.stubGlobal('uni', mock)
  return mock
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('startHorizontalEvidenceCapture', () => {
  it('filters inaccurate fixes and classifies immobility from the median speed', async () => {
    const mock = installLocationMock()
    const capture = await startHorizontalEvidenceCapture()

    mock.emit({ speed: 0.2, accuracy: 5 })
    mock.emit({ speed: 5, accuracy: 50 })
    mock.emit({ speed: 0.3, accuracy: 5 })
    mock.emit({ speed: 1.5, accuracy: 3 })
    mock.emit({ speed: 0.1, accuracy: 5 })

    const evidence = await capture.stop()

    expect(evidence.available).toBe(true)
    expect(evidence.sampleCount).toBe(4)
    expect(evidence.medianSpeedMps).toBe(0.25)
    expect(evidence.isImmobile).toBe(true)
    expect(mock.offLocationChange).toHaveBeenCalledTimes(1)
    expect(mock.stopLocationUpdate).toHaveBeenCalledTimes(1)
  })

  it('flags horizontal movement when the median speed exceeds the limit', async () => {
    const mock = installLocationMock()
    const capture = await startHorizontalEvidenceCapture()

    mock.emit({ speed: 1.2, accuracy: 5 })
    mock.emit({ speed: 1.3, accuracy: 5 })
    mock.emit({ speed: 1.4, accuracy: 5 })

    const evidence = await capture.stop()

    expect(evidence.available).toBe(true)
    expect(evidence.medianSpeedMps).toBe(1.3)
    expect(evidence.isImmobile).toBe(false)
  })

  it('marks evidence unavailable without enough valid samples', async () => {
    installLocationMock()
    const capture = await startHorizontalEvidenceCapture()

    const evidence = await capture.stop()

    expect(evidence.available).toBe(false)
    expect(evidence.sampleCount).toBe(0)
    expect(evidence.medianSpeedMps).toBeNull()
    expect(evidence.isImmobile).toBe(false)
  })

  it('rejects when location start is denied and detaches the listener', async () => {
    const mock = installLocationMock()
    mock.startLocationUpdate.mockImplementation((options?: {
      fail?: (error: unknown) => void
    }) => {
      options?.fail?.({ errMsg: 'startLocationUpdate:fail auth deny' })
    })

    await expect(startHorizontalEvidenceCapture()).rejects.toThrow('auth deny')

    expect(mock.offLocationChange).toHaveBeenCalledTimes(1)
    expect(mock.stopLocationUpdate).toHaveBeenCalledTimes(1)
  })

  it('rejects when location APIs are unavailable', async () => {
    vi.stubGlobal('uni', {})

    await expect(startHorizontalEvidenceCapture()).rejects.toThrow(
      'Horizontal evidence APIs are unavailable.'
    )
  })
})
