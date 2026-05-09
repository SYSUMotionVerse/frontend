import { describe, expect, it, vi } from 'vitest'
import { BLAZEPOSE_MODEL_NAME, createBlazePoseModelConfig } from '../uni-app/components/pose/PoseDetectModel'

describe('createBlazePoseModelConfig', () => {
  it('builds a self-contained BlazePose config from in-memory handlers', async () => {
    const detectorHandler = { load: vi.fn() } as any
    const landmarkHandler = { load: vi.fn() } as any

    const config = await createBlazePoseModelConfig({
      createDetectorHandler: async () => detectorHandler,
      createLandmarkLiteHandler: async () => landmarkHandler
    })

    expect(BLAZEPOSE_MODEL_NAME).toBe('BlazePose')
    expect(config.runtime).toBe('tfjs')
    expect(config.modelType).toBe('lite')
    expect(config.enableSmoothing).toBe(true)
    expect(config.detectorModelUrl).toBe(detectorHandler)
    expect(config.landmarkModelUrl).toBe(landmarkHandler)
    expect(typeof config.detectorModelUrl).not.toBe('string')
    expect(typeof config.landmarkModelUrl).not.toBe('string')
  })
})
