import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('BlazePose weight specs', () => {
  it('preserves quantization metadata through tfjs weight-spec helpers', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/model-loader.ts'),
      'utf8'
    )

    expect(source).toContain('tf.io.getWeightSpecs(modelJson.weightsManifest)')
    expect(source).toContain('quantization: firstSpec.quantization')
    expect(source).toContain('quantization: lastSpec.quantization')
  })
})
