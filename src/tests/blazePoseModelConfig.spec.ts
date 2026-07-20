import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BLAZEPOSE_MODEL_NAME,
  DEFAULT_POSE_MODEL_BASE_URL,
  createBlazePoseModelConfig
} from '../subpackages/training/components/pose/PoseDetectModel'

describe('createBlazePoseModelConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads BlazePose models from HTTP URLs instead of embedding model weights in the source package', () => {
    const config = createBlazePoseModelConfig({
      modelBaseUrl: DEFAULT_POSE_MODEL_BASE_URL
    })

    expect(BLAZEPOSE_MODEL_NAME).toBe('BlazePose')
    expect(config.runtime).toBe('tfjs')
    expect(config.modelType).toBe('lite')
    expect(config.enableSmoothing).toBe(true)
    expect(config.detectorModelUrl).toBe(`${DEFAULT_POSE_MODEL_BASE_URL}/detector/model.json`)
    expect(config.landmarkModelUrl).toBe(`${DEFAULT_POSE_MODEL_BASE_URL}/landmark_lite/model.json`)
    expect(config.detectorModelUrl).toMatch(/^https?:\/\//)
    expect(config.landmarkModelUrl).toMatch(/^https?:\/\//)
  })

  it('allows iPhone previews to point at a LAN-hosted model server', () => {
    vi.stubEnv('VITE_POSE_MODEL_BASE_URL', 'http://192.168.1.20:8765/')

    const config = createBlazePoseModelConfig()

    expect(config.detectorModelUrl).toBe('http://192.168.1.20:8765/detector/model.json')
    expect(config.landmarkModelUrl).toBe('http://192.168.1.20:8765/landmark_lite/model.json')
  })

  it('keeps oversized model payloads out of src so WeChat preview can upload the package', () => {
    const generatedModelData = resolve(process.cwd(), 'src/uni-app/components/pose/model-data.gen.ts')
    const staticModelDir = resolve(process.cwd(), 'src/static/models')
    const poseModelSource = resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectModel.ts')

    expect(existsSync(generatedModelData)).toBe(false)
    expect(existsSync(staticModelDir)).toBe(false)
    expect(statSync(poseModelSource).size).toBeLessThan(20 * 1024)
  })
})
