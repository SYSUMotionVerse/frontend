import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView analyze latency', () => {
  it('uses the inferFromCanvas latency from the captured photo instead of the last live frame', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('async function runPhotoInference()')
    expect(source).toMatch(/const\s+\{\s*poses,\s*inferMs:\s*sampleInferMs\s*\}\s*=\s*await inferFromCanvas/)
    expect(source).toContain('inferMs = sampleInferMs')
    expect(source).toContain('await runPhotoInference()')
    expect(source).not.toContain('analyzeMs.value = inferMs')
  })
})
