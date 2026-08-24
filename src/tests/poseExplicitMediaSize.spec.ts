import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Pose camera measured media size', () => {
  it('carries a typed optional size through the detector to both native layers', () => {
    const detectorSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const cameraSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(detectorSource).toContain('type PoseMediaSize = Readonly<{')
    expect(detectorSource).toContain('mediaSize?: PoseMediaSize;')
    expect(detectorSource).toContain(':media-size="props.mediaSize"')
    expect(cameraSource).toContain('mediaSize?: PoseMediaSize;')
    expect(cameraSource).toContain('const measuredMediaSize = computed(() => {')
    expect(cameraSource).toContain('width: `${size.width}px`')
    expect(cameraSource).toContain('height: `${size.height}px`')
    expect(cameraSource).toMatch(/<camera[\s\S]*:style="nativeMediaStyle"/)
    expect(cameraSource).toMatch(/<canvas[\s\S]*:style="overlayCanvasStyle"/)
  })
})
