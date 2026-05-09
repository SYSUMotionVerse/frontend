import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView analyze latency', () => {
  it('uses the inferFromCanvas latency from the captured photo instead of the last live frame', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toMatch(/const\s+\{\s*poses,\s*inferMs:\s*analyzeInferMs\s*\}\s*=\s*await inferFromCanvas/)
    expect(source).toMatch(/analyzeMs\.value\s*=\s*analyzeInferMs/)
    expect(source).not.toContain('analyzeMs.value = inferMs')
  })
})
