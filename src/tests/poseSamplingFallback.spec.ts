import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView sampling fallback', () => {
  it('falls back to sampled photo inference when realtime camera frames are unsupported', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('function startSamplingFallback(')
    expect(source).toContain('function scheduleNextSamplingFrame(')
    expect(source).toContain('function stopSamplingFallback()')
    expect(source).toContain('samplingFallbackTimer = setTimeout(async () => {')
    expect(source).toContain('sampleFallbackFrame()')
    expect(source).toContain("case 'cameraFail':")
    expect(source).toContain('startSamplingFallback(evt.detail)')
  })

  it('uses sampled inference by default in production to avoid realtime-frame GPU pressure', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toMatch(
      /if \(isDebugMode\.value\)[\s\S]*startCamera\(\)[\s\S]*else[\s\S]*startSamplingFallback\('production-safe-mode'\)/
    )
    expect(source).toMatch(/if \(isDebugMode\.value\) \{\s*await warmDetector\(\)\s*\}/)
  })

  it('keeps sampled keypoints visible instead of hiding the overlay', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('const overlayEnabled = computed(() => showOverlay.value)')
    expect(source).not.toContain('if (!usingSamplingFallback && poses.length > 0')
  })
})
