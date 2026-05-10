import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView sampling fallback', () => {
  it('falls back to sampled photo inference when realtime camera frames are unsupported', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('const SAMPLING_FALLBACK_INTERVAL_MS =')
    expect(source).toContain('function startSamplingFallback(')
    expect(source).toContain('function stopSamplingFallback()')
    expect(source).toContain('setInterval(() => {')
    expect(source).toContain('sampleFallbackFrame()')
    expect(source).toContain("case 'cameraFail':")
    expect(source).toContain('startSamplingFallback(evt.detail)')
  })
})
