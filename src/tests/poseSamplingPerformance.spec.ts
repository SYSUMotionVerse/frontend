import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView sampling performance', () => {
  it('retains a lightweight single-shot photo path for debug user-triggered analysis', () => {
    const viewSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const cameraSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseCamera.vue'),
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

  it('accepts a configurable target sampling fps for live camera throttling', () => {
    const cameraSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(cameraSource).toContain('targetFps?: number')
    expect(cameraSource).toContain('const targetFps = computed(() => Math.max(1, Math.round(props.targetFps ?? 5)))')
    expect(cameraSource).toContain('const frameGap = computed(() => Math.max(1, Math.round(30 / targetFps.value)))')
    expect(cameraSource).toContain('new FrameAdapter(() => frameGap.value)')
  })

  it('defaults live recognition to the lower 5fps mode on mobile preview', () => {
    const viewSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const cameraSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(viewSource).toContain('const samplingFps = ref<5 | 10>(props.initialFps ?? 5)')
    expect(cameraSource).toContain('props.targetFps ?? 5')
  })

  it('runs live inference only for formal training and enforces a completion-based cooldown', () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )
    const viewSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(panelSource).toContain(':detection-active="recognitionEnabled && trainingStarted && phaseKind === \'active\'"')
    expect(viewSource).toContain('detectionActive?: boolean')
    expect(viewSource).toContain('const detectionActive = computed(() => props.detectionActive ?? true)')
    expect(viewSource).toContain('nextInferenceEligibleAt')
    expect(viewSource).toContain('Date.now() + getSamplingIntervalMs(effectiveSamplingFps.value)')
    expect(viewSource).toContain('updateEffectiveSamplingFps(inferMs)')
  })

  it('uses small camera frames and avoids copying full frames into the overlay canvas during live inference', () => {
    const viewSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const cameraSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(cameraSource).toContain('frame-size="small"')
    expect(viewSource).not.toContain('drawFrame(frame)')
    expect(viewSource).toContain('poseCamera.value?.setOverlayFrame(frame.width, frame.height)')
  })
})
