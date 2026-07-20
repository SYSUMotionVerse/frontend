import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('pose detector lifecycle disposal', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
    'utf8'
  )

  it('calls detector.dispose() in onUnmounted to free GPU resources', () => {
    expect(source).toContain('detector.dispose()')
  })

  it('guards against mount/unmount race during async onMounted', () => {
    expect(source).toContain('isMounted')
    expect(source).toContain('isMounted = true')
    expect(source).toContain('isMounted = false')
    // Guards after each await point
    expect(source).toMatch(/await tf\.ready\(\)[\s\S]*if \(!isMounted\) return/)
    expect(source).toMatch(/loadedDetector = await loadBlazePose[\s\S]*if \(!isMounted\)[\s\S]*loadedDetector\.dispose/)
  })

  it('waits for native camera init before allocating the WebGL backend', () => {
    const cameraReadyGate = source.indexOf('await waitForCameraReady()')
    const webglAllocation = source.indexOf("type: 'webgl'")

    expect(cameraReadyGate).toBeGreaterThan(-1)
    expect(webglAllocation).toBeGreaterThan(cameraReadyGate)
  })

  it('does not retain a sampling fallback timer on unmount', () => {
    // The sampling-fallback timer machinery has been removed; unmount
    // cleans up via detector.dispose() and poseCamera.stopCamera() only.
    expect(source).not.toContain('samplingFallbackTimer')
    expect(source).not.toContain('stopSamplingFallback')
  })

  it('stops the camera on unmount', () => {
    expect(source).toMatch(/onUnmounted\([\s\S]*poseCamera\.value\?\.stopCamera\(\)/)
  })

  it('disposes the warmup tensor in a try/finally so estimatePoses rejection cannot leak it', () => {
    // The warmup tensor must be disposed even if estimatePoses rejects.
    expect(source).toMatch(
      /warmupTensor\s*=\s*tf\.tensor3d[\s\S]*try\s*\{[\s\S]*estimatePoses\(warmupTensor\)[\s\S]*\}\s*finally\s*\{[\s\S]*warmupTensor\.dispose\(\)/
    )
  })

  it('disposes intermediate tensors after inference, including on rejection', () => {
    // onFrame path: tensor disposed in a finally block that also resets liveInferenceInFlight
    expect(source).toMatch(
      /try\s*\{[\s\S]*rgbTensor\s*=\s*tf\.tensor3d[\s\S]*try\s*\{[\s\S]*estimatePoses[\s\S]*\}\s*finally\s*\{[\s\S]*rgbTensor\.dispose\(\)[\s\S]*\}[\s\S]*\}\s*finally\s*\{[\s\S]*liveInferenceInFlight\s*=\s*false/
    )

    // inferFromCanvas path: tensor disposed in a finally block around estimatePoses,
    // so a rejection cannot leak it
    expect(source).toMatch(
      /rgbTensor\s*=\s*tf\.tensor3d[\s\S]*try\s*\{[\s\S]*estimatePoses\(rgbTensor[\s\S]*\}\s*finally\s*\{[\s\S]*rgbTensor\.dispose\(\)/
    )
  })

  it('disposes and nulls the detector in the outer catch after a failed warm-up or model init', () => {
    // If the detector was assigned before a failure (e.g. warm-up rejected),
    // the catch block must dispose and null it so GPU resources are not retained.
    expect(source).toMatch(
      /catch\s*\(err[\s\S]*if\s*\(detector\)\s*\{[\s\S]*detector\.dispose\(\)[\s\S]*detector\s*=\s*null/
    )
  })

  it('disposes the detector loaded during mount if unmount fires first', () => {
    // If the component unmounts while the detector is being loaded,
    // the loaded detector should be disposed immediately rather than leaked.
    expect(source).toMatch(/if \(!isMounted\)[\s\S]*loadedDetector\.dispose/)
  })
})
