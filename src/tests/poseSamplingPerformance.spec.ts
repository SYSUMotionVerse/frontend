import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView sampling performance', () => {
  it('uses a lightweight sampled-photo path for fallback inference', () => {
    const viewSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const cameraSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(viewSource).toContain('const SAMPLING_FALLBACK_MAX_SIDE =')
    expect(viewSource).toContain('const SAMPLING_FALLBACK_CAPTURE_QUALITY:')
    expect(viewSource).toContain('takePhotoWithQuality?.(SAMPLING_FALLBACK_CAPTURE_QUALITY)')
    expect(viewSource).toContain('function scaleFrameSize(')
    expect(viewSource).toContain('poseCamera.value.setOverlayFrame?.(')
    expect(viewSource).not.toContain('poseCamera.value.drawFrame(frame)\n  firstFrameReceived.value = true')
    expect(cameraSource).toContain('function setOverlayFrame(')
    expect(cameraSource).toContain('takePhotoWithQuality')
    expect(cameraSource).toContain('setOverlayFrame')
  })
})
