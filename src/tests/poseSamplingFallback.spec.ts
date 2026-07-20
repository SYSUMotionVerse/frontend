import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView continuous-frame production recognition', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
    'utf8'
  )

  it('starts the continuous camera frame listener in production instead of repeated takePhoto', () => {
    // Production must call startCamera() — the continuous onCameraFrame
    // listener throttled by PoseCamera's FrameAdapter — instead of a timer
    // loop that repeatedly triggers the native takePhoto shutter.
    expect(source).toContain('poseCamera.value?.startCamera()')
    expect(source).not.toContain("startSamplingFallback('production-safe-mode')")
  })

  it('cannot automatically schedule repeated takePhoto calls for recognition', () => {
    // The sampling-fallback timer machinery that repeatedly called takePhoto
    // must not exist in the production runtime path.
    expect(source).not.toContain('function startSamplingFallback(')
    expect(source).not.toContain('function scheduleNextSamplingFrame(')
    expect(source).not.toContain('function stopSamplingFallback()')
    expect(source).not.toContain('function sampleFallbackFrame(')
    expect(source).not.toContain('samplingFallbackTimer = setTimeout(async () => {')
    expect(source).not.toContain('getNextSamplingDelayMs')
  })

  it('does not fall back to repeated takePhoto when continuous frames are unavailable', () => {
    // cameraFail must surface a stable, non-flashing error state — not
    // auto-fallback to a takePhoto timer loop.
    expect(source).toContain("case 'cameraFail':")
    expect(source).not.toContain('startSamplingFallback(evt.detail)')
  })

  it('retains single-shot photo analysis only for debug user-triggered use', () => {
    // runPhotoInference is kept for the debug Analyze button (user-triggered),
    // not for automatic production recognition.
    expect(source).toContain('async function runPhotoInference()')
    expect(source).toContain('async function analyzeFrame()')
    // The analyze button is debug-only.
    expect(source).toMatch(/<view v-if="cameraReady && props\.mode === 'debug'" class="analyze-bar">/)
  })
})