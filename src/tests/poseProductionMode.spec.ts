import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView production mode', () => {
  it('keeps analyze controls debug-only and exposes recording methods', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toMatch(/<view v-if="cameraReady && props\.mode === 'debug'" class="analyze-bar">/)
    expect(source).toMatch(/startRecord:\s*\(\)\s*=>\s*poseCamera\.value\?\.startRecord\?\.\(\)/)
    expect(source).toMatch(/stopRecord:\s*\(\)\s*=>\s*poseCamera\.value\?\.stopRecord\?\.\(\)/)
  })

  it('passes a debug sampling fps selector into the pose camera', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('samplingFps')
    expect(source).toContain(':target-fps="samplingFps"')
    expect(source).toContain("initialFps?: 5 | 10")
    expect(source).toContain("const samplingFps = ref<5 | 10>(props.initialFps ?? 5)")
    expect(source).toContain('5 fps')
    expect(source).toContain('10 fps')
  })

  it('surfaces detector load failures in the camera error banner', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('detectorError')
    expect(source).toContain("emitStats('failed')")
    expect(source).toContain('cameraError.value || detectorError.value')
    expect(source).toContain('cameraErrorBanner')
  })
})
