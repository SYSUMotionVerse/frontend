import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import { loadGraphModelSync } from '@tensorflow/tfjs-converter'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  DETECTOR_MODEL_JSON_CHUNKS,
  DETECTOR_WEIGHT_BASE64_CHUNKS,
} from '../uni-app/components/pose/model-data.gen'

describe('BlazePose model loader', () => {
  beforeAll(async () => {
    await tf.setBackend('cpu')
    await tf.ready()
  })

  it('loads generated model data through a stable static import', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/model-loader.ts'),
      'utf8'
    )

    expect(source).toContain("from './model-data.gen'")
    expect(source).not.toContain("await import('./model-data.gen')")
    expect(source).toMatch(/JSON\.parse\(modelData\.DETECTOR_MODEL_JSON_CHUNKS\.join\(''\)\)/)
    expect(source).toMatch(/JSON\.parse\(modelData\.LANDMARK_LITE_MODEL_JSON_CHUNKS\.join\(''\)\)/)
  })

  it('normalizes graph-model json into proper tfjs model artifacts', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/model-loader.ts'),
      'utf8'
    )

    expect(source).toMatch(/return tf\.io\.fromMemory\(\s*toModelArtifacts\(/)
    expect(source).toContain('tf.io.getWeightSpecs(modelJson.weightsManifest)')
    expect(source).toContain('tf.io.getModelArtifactsForJSONSync(')
    expect(source).not.toContain('modelTopology: modelData.DETECTOR_MODEL_JSON_CHUNKS')
    expect(source).not.toContain('modelTopology: modelData.LANDMARK_LITE_MODEL_JSON_CHUNKS')
  })

  it('adds diagnostic validation before handing weights to tfjs decoding', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/model-loader.ts'),
      'utf8'
    )

    expect(source).toContain('validateWeightSpecs(')
    expect(source).toContain('logModelArtifactsSummary(')
  })

  it('keeps detector model json compatible with tfjs graph model loading', () => {
    const detectorModelJson = JSON.parse(DETECTOR_MODEL_JSON_CHUNKS.join(''))
    const weightData = Uint8Array.from(
      Buffer.from(DETECTOR_WEIGHT_BASE64_CHUNKS.join(''), 'base64')
    ).buffer
    const weightSpecs = tf.io.getWeightSpecs(detectorModelJson.weightsManifest as any)
    const artifacts = tf.io.getModelArtifactsForJSONSync(
      detectorModelJson as any,
      weightSpecs,
      weightData
    )

    const model = loadGraphModelSync([
      detectorModelJson as any,
      artifacts.weightData as ArrayBuffer,
    ])

    expect(model.inputNodes.length).toBeGreaterThan(0)
    expect(model.outputNodes.length).toBeGreaterThan(0)
    expect(artifacts.weightSpecs?.[0]?.dtype).toBe('float32')

    model.dispose()
  })
})
