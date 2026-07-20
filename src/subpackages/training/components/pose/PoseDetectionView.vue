<script setup lang="ts">
/**
 * PoseDetectionView — BlazePose-Lite detector controller.
 *
 * Manages the full inference lifecycle:
 *   1. setupWechatPlatform() — initialise TFJS + WebGL
 *   2. loadBlazePose()       — load only the BlazePose TFJS implementation
 *   3. warmModel()           — first dummy inference to JIT-compile kernels
 *   4. single-shot analyze   — takePhoto → decode → estimatePoses → overlay
 *
 * Props:
 *   onResult  — called with { pose, inferMs, ts } when a pose is detected
 *   onStats   — called with { status, loadMs, warmMs, inferMs, fps }
 */
import { load as loadBlazePose } from '@tensorflow-models/pose-detection/dist/blazepose_tfjs/detector';
import type { PoseDetector } from '@tensorflow-models/pose-detection/dist/pose_detector';
import * as tf from '@tensorflow/tfjs-core';
import * as webgl from '@tensorflow/tfjs-backend-webgl';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { createBlazePoseModelConfig } from './PoseDetectModel';
import { setupWechatPlatform } from './wechat_platform';
import { fetchFunc } from './fetch';
import type { DetectResult, Frame } from './PoseDetectModel';
import { buildPoseAngleFrame } from '../../../../uni-app/components/pose/poseAnalysis'
import PoseCamera from './PoseCamera.vue';

const props = defineProps<{
  /** Runtime mode: 'production' (default) for training page, 'debug' for spike diagnostics. */
  mode?: 'production' | 'debug';
  initialFps?: 5 | 10;
  onResult: (result: DetectResult) => void;
  onStats: (stats: { status: string; loadMs: number; warmMs: number; inferMs: number; fps: number }) => void;
}>();

const SAMPLING_FALLBACK_MAX_SIDE = 256
const SAMPLING_FALLBACK_CAPTURE_QUALITY: 'low' = 'low'

const poseCamera = ref<any>(null);
let detector: PoseDetector | null = null;
let isMounted = false;
let resolveCameraReady: (() => void) | null = null
let rejectCameraReady: ((error: Error) => void) | null = null
const cameraReadyPromise = new Promise<void>((resolve, reject) => {
  resolveCameraReady = resolve
  rejectCameraReady = reject
})

// Camera lifecycle state
const cameraReady = ref(false);
const cameraError = ref('');
const detectorError = ref('');
const cameraErrorBanner = computed(() => cameraError.value || detectorError.value);

// Overlay canvas visibility — stays hidden until first frame or pose
const firstFrameReceived = ref(false);
const firstPoseEstimated = ref(false);
const showOverlay = computed(() => firstFrameReceived.value || firstPoseEstimated.value);
const overlayEnabled = computed(() => showOverlay.value)

// Single-shot analysis
const analyzing = ref(false);
const countdown = ref(0);
const analyzeMs = ref(0);
const analyzeKeypoints = ref<any[]>([]);
const analyzeKeypointCount = computed(() => analyzeKeypoints.value.length);
const isDebugMode = computed(() => props.mode === 'debug');
const samplingFps = ref<5 | 10>(props.initialFps ?? 5)

// Runtime stats (non-reactive internal counters)
let loadMs = 0;
let warmMs = 0;
let inferMs = 0;
let frameCount = 0;
let lastFrameTime = 0;
let fps = 0;
let liveInferenceInFlight = false;
let emittedFrameIndex = 0

// ───────────────────────────────────────────
//  Detector lifecycle
// ───────────────────────────────────────────

onMounted(async () => {
  isMounted = true;

  try {
    // Let the native camera finish allocating first. Initialising camera and
    // TFJS WebGL concurrently can exceed the mini-program GPU startup budget.
    await waitForCameraReady()
    if (!isMounted) return

    const t0 = Date.now();

    // 1. Initialise TFJS + WeChat WebGL
    const offscreenCanvas = wx.createOffscreenCanvas({
      type: 'webgl',
      width: 192,
      height: 192,
    });
    setupWechatPlatform({ fetchFunc, tf, webgl, canvas: offscreenCanvas });
    await tf.ready();

    // Guard: unmount may have fired during await
    if (!isMounted) return;

    // 2. Load detector
    const config = await createBlazePoseModelConfig();
    const loadedDetector = await loadBlazePose(config as any);

    // Guard: unmount may have fired during detector load
    if (!isMounted) {
      try { loadedDetector.dispose(); } catch { /* already disposed */ }
      return;
    }
    detector = loadedDetector;
    loadMs = Date.now() - t0;

    // 3. Keep shader warm-up debug-only. Production performs its first
    // inference on a bounded 256px sample instead of adding a startup spike.
    if (isDebugMode.value) {
      await warmDetector()
    }

    // Guard: unmount may have fired during warm-up
    if (!isMounted) return;

    // 4. Start the continuous camera frame listener. Both production and
    // debug consume CameraContext.onCameraFrame() throttled to the selected
    // fps via PoseCamera's FrameAdapter. The repeated native takePhoto()
    // shutter that caused the bright/cream overlay flash is no longer used
    // for automatic recognition.
    poseCamera.value?.startCamera()
    emitStats('ready');
  } catch (err: any) {
    if (!isMounted) return;
    // If the detector was assigned before the failure (e.g. warm-up rejected),
    // dispose and null it so the failed component does not retain GPU resources
    // until unmount.
    if (detector) {
      try { detector.dispose(); } catch { /* already disposed */ }
      detector = null;
    }
    detectorError.value = err?.message ?? 'detector load failed';
    console.warn('[pose] detector load failed:', detectorError.value);
    emitStats('failed');
  }
});

onUnmounted(() => {
  isMounted = false;
  rejectCameraReady?.(new Error('pose detector unmounted before camera ready'))
  // Dispose the TF.js detector to free WebGL/GPU resources.
  if (detector) {
    try { detector.dispose(); } catch { /* detector may already be disposed */ }
    detector = null;
  }
  poseCamera.value?.stopCamera();
});

function emitStats(status: string) {
  props.onStats({ status, loadMs, warmMs, inferMs, fps });
}

function waitForCameraReady() {
  return cameraReadyPromise
}

async function warmDetector() {
  if (!detector) return
  const t1 = Date.now()
  const warmupTensor = tf.tensor3d(new Float32Array([0, 0, 0]), [1, 1, 3])
  try {
    await detector.estimatePoses(warmupTensor)
  } finally {
    warmupTensor.dispose()
  }
  warmMs = Date.now() - t1
}

// ───────────────────────────────────────────
//  Inference — try multiple input formats
// ───────────────────────────────────────────

/**
 * Run pose detection on an offscreen canvas, trying multiple input formats.
 * Returns { poses, inferMs }.
 */
async function inferFromCanvas(
  offCanvas: any,
  width: number,
  height: number,
): Promise<{ poses: any[]; inferMs: number }> {
  const ctx = offCanvas.getContext('2d') as CanvasRenderingContext2D;
  const imageData = ctx.getImageData(0, 0, width, height);

  // Attempt 1: offscreen canvas directly (TFJS → texImage2D)
  try {
    const t0 = Date.now();
    const poses = await detector!.estimatePoses(offCanvas, { flipHorizontal: false });
    const ms = Date.now() - t0;
    if (poses.length > 0) return { poses, inferMs: ms };
  } catch { /* fall through */ }

  // Attempt 2: ImageData directly
  try {
    const t0 = Date.now();
    const poses = await detector!.estimatePoses(imageData, { flipHorizontal: false });
    const ms = Date.now() - t0;
    if (poses.length > 0) return { poses, inferMs: ms };
  } catch { /* fall through */ }

  // Attempt 3: Manual RGB tensor (no tf.slice — avoids WebGL alignment issues)
  const raw = imageData.data;
  const pixelCount = raw.length / 4;
  const rgb = new Uint8Array(pixelCount * 3);
  for (let i = 0, j = 0; i < raw.length; i += 4) {
    rgb[j++] = raw[i];
    rgb[j++] = raw[i + 1];
    rgb[j++] = raw[i + 2];
  }
  const rgbTensor = tf.tensor3d(rgb, [height, width, 3]);
  try {
    const t0 = Date.now();
    const poses = await detector!.estimatePoses(rgbTensor, { flipHorizontal: false });
    const ms = Date.now() - t0;
    return { poses, inferMs: ms };
  } finally {
    rgbTensor.dispose();
  }
}

function scaleFrameSize(width: number, height: number, maxSide: number) {
  const longestSide = Math.max(width, height)
  if (!longestSide || longestSide <= maxSide) {
    return { width, height }
  }

  const scale = maxSide / longestSide
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function runPhotoInference() {
  if (!detector || !poseCamera.value) return

  const photo = await poseCamera.value.takePhotoWithQuality?.(SAMPLING_FALLBACK_CAPTURE_QUALITY)
    ?? await poseCamera.value.takePhoto()
  if (!photo.width || !photo.height) {
    return
  }

  const scaled = scaleFrameSize(photo.width, photo.height, SAMPLING_FALLBACK_MAX_SIDE)
  const offCanvas = wx.createOffscreenCanvas({ type: '2d', width: scaled.width, height: scaled.height })
  const offCtx = offCanvas.getContext('2d') as CanvasRenderingContext2D
  const img = offCanvas.createImage()

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = (err: any) => reject(new Error(err?.errMsg ?? 'photo decode failed'))
    img.src = photo.tempImagePath
  })

  offCtx.drawImage(img as any, 0, 0, scaled.width, scaled.height)
  const { poses, inferMs: sampleInferMs } = await inferFromCanvas(offCanvas, scaled.width, scaled.height)
  inferMs = sampleInferMs
  if (poses.length > 0 && poses[0].keypoints) {
    poseCamera.value.setOverlayFrame?.(scaled.width, scaled.height)
    firstFrameReceived.value = true
    firstPoseEstimated.value = true
    poseCamera.value.drawKeypoints(poses[0].keypoints)
  }

  if (poses.length > 0 && poses[0].keypoints) {
    const tsMs = Date.now()
    props.onResult({
      pose: poses[0],
      inferMs,
      tsMs,
      frameIndex: emittedFrameIndex++,
      angleFrame: buildPoseAngleFrame(poses[0], tsMs)
    })
  }
}

// ───────────────────────────────────────────
//  Camera frame pump (live listener path)
// ───────────────────────────────────────────

/** Called by PoseCamera for every camera frame (throttled to ~10 fps). */
async function onFrame(frame: Frame) {
  if (!detector || liveInferenceInFlight) return;
  liveInferenceInFlight = true;
  const t = Date.now();
  try {
    // RGBA → RGB tensor (manual extraction, no tf.slice)
    const data = frame.data;
    const pxCount = (data.length / 4) | 0;
    const rgb = new Uint8Array(pxCount * 3);
    for (let i = 0, j = 0; i < data.length; i += 4) {
      rgb[j++] = data[i];
      rgb[j++] = data[i + 1];
      rgb[j++] = data[i + 2];
    }
    const rgbTensor = tf.tensor3d(rgb, [frame.height, frame.width, 3]);
    let poses
    try {
      poses = await detector.estimatePoses(rgbTensor, { flipHorizontal: false });
    } finally {
      rgbTensor.dispose();
    }
    inferMs = Date.now() - t;

    // Rolling FPS
    frameCount++;
    if (lastFrameTime === 0) lastFrameTime = t;
    const elapsed = t - lastFrameTime;
    if (elapsed >= 1000) {
      fps = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      lastFrameTime = t;
    }

    if (poses && poses.length > 0) {
      if (!firstPoseEstimated.value) firstPoseEstimated.value = true;
      poseCamera.value?.setOverlayFrame(frame.width, frame.height);
      poseCamera.value?.drawKeypoints(poses[0].keypoints);
      const tsMs = Date.now()
      props.onResult({
        pose: poses[0],
        inferMs,
        tsMs,
        frameIndex: emittedFrameIndex++,
        angleFrame: buildPoseAngleFrame(poses[0], tsMs)
      });
    }
    emitStats('detecting');
  } finally {
    liveInferenceInFlight = false;
  }
}

// ───────────────────────────────────────────
//  Single-shot analysis
// ───────────────────────────────────────────

async function analyzeFrame() {
  if (analyzing.value || !detector || !poseCamera.value) return;
  analyzing.value = true;
  try {
    // Countdown — user moves hands away
    countdown.value = 1;
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    countdown.value = 0;

    const before = Date.now()
    await runPhotoInference()
    analyzeMs.value = Date.now() - before
  } catch (err: any) {
    console.warn('[Analyze] failed:', err?.message ?? err);
  } finally {
    analyzing.value = false;
  }
}

// ───────────────────────────────────────────
//  Camera status events
// ───────────────────────────────────────────

function onCameraStatus(evt: { type: string; detail?: string }) {
  switch (evt.type) {
    case 'cameraReady':
      cameraReady.value = true;
      resolveCameraReady?.()
      break;
    case 'cameraInitError': {
      const message = evt.detail ?? 'camera init failed'
      cameraError.value = message
      rejectCameraReady?.(new Error(message))
      break;
    }
    case 'cameraFail':
      // Surface a stable, non-flashing error state. Do not fall back to
      // repeated takePhoto() — the native shutter causes the bright overlay.
      cameraError.value = evt.detail ?? '';
      break;
    case 'firstFrame':
      firstFrameReceived.value = true;
      break;
  }
}

// ───────────────────────────────────────────
//  Controls
// ───────────────────────────────────────────

defineExpose({
  startDetect: () => poseCamera.value?.startCamera(),
  stopDetect: () => poseCamera.value?.stopCamera(),
  startRecord: () => poseCamera.value?.startRecord?.(),
  stopRecord: () => poseCamera.value?.stopRecord?.()
});
</script>

<template>
  <!-- Camera view + overlay canvas -->
  <PoseCamera
    ref="poseCamera"
    class="pose-detection-view__camera"
    :on-frame="onFrame"
    :on-status="onCameraStatus"
    :show-overlay="overlayEnabled"
    :target-fps="samplingFps"
  />

  <!-- Analyze button — single-shot capture -->
  <view v-if="cameraReady && props.mode === 'debug'" class="analyze-bar">
    <view class="sampling-toggle">
      <button class="sampling-toggle-btn" :class="{ active: samplingFps === 5 }" @click="samplingFps = 5">5 fps</button>
      <button class="sampling-toggle-btn" :class="{ active: samplingFps === 10 }" @click="samplingFps = 10">10 fps</button>
    </view>
    <button class="analyze-btn" :disabled="analyzing" @click="analyzeFrame">
      {{ countdown > 0 ? '⏳ ' + countdown + 's...' : analyzing ? '⏳ Analyzing...' : '📸 Analyze' }}
    </button>
    <view v-if="analyzeMs > 0" class="analyze-result">
      {{ analyzeMs }}ms · {{ analyzeKeypointCount }} keypoints
      <text v-if="analyzeKeypointCount === 0"> · No pose detected</text>
    </view>
  </view>

  <!-- Error indicator -->
  <view v-if="cameraErrorBanner" class="camera-error">{{ cameraErrorBanner }}</view>
</template>

<script lang="ts">
export default {
  options: { styleIsolation: 'shared' },
};
</script>

<style>
.pose-detection-view__camera {
  display: block;
  width: 100%;
  height: 100%;
}

/* Analyze button bar — bottom-center fixed */
.analyze-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 998;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.sampling-toggle {
  display: flex;
  gap: 6px;
}
.sampling-toggle-btn {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 12px;
}
.sampling-toggle-btn.active {
  background: rgba(74, 222, 128, 0.85);
  color: #000;
}
.analyze-btn {
  padding: 10px 24px;
  border-radius: 999px;
  border: none;
  background: rgba(74, 222, 128, 0.85);
  color: #000;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
.analyze-btn:disabled { opacity: 0.5; }
.analyze-result {
  background: rgba(0, 0, 0, 0.6);
  color: #4ade80;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
}

/* Camera error banner */
.camera-error {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: rgba(239, 68, 68, 0.85);
  color: #fff;
  padding: 6px 12px;
  font-size: 12px;
  text-align: center;
}
</style>
