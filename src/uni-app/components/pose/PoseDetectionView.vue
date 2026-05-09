<script setup lang="ts">
/**
 * PoseDetectionView — BlazePose-Lite detector controller.
 *
 * Manages the full inference lifecycle:
 *   1. setupWechatPlatform() — initialise TFJS + WebGL
 *   2. createDetector()      — load embedded BlazePose-Lite model handlers
 *   3. warmModel()           — first dummy inference to JIT-compile kernels
 *   4. single-shot analyze   — takePhoto → decode → estimatePoses → overlay
 *
 * Props:
 *   onResult  — called with { pose, inferMs, ts } when a pose is detected
 *   onStats   — called with { status, loadMs, warmMs, inferMs, fps }
 */
import { createDetector, type PoseDetector } from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import * as webgl from '@tensorflow/tfjs-backend-webgl';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { BLAZEPOSE_MODEL_NAME, createBlazePoseModelConfig } from './PoseDetectModel';
import { setupWechatPlatform } from './wechat_platform';
import { fetchFunc } from './fetch';
import type { DetectResult, Frame } from './PoseDetectModel';
import PoseCamera from './PoseCamera.vue';

const props = defineProps<{
  /** Runtime mode: 'production' (default) for training page, 'debug' for spike diagnostics. */
  mode?: 'production' | 'debug';
  onResult: (result: DetectResult) => void;
  onStats: (stats: { status: string; loadMs: number; warmMs: number; inferMs: number; fps: number }) => void;
}>();

const poseCamera = ref<any>(null);
let detector: PoseDetector | null = null;

// Camera lifecycle state
const cameraReady = ref(false);
const cameraError = ref('');

// Overlay canvas visibility — stays hidden until first frame or pose
const firstFrameReceived = ref(false);
const firstPoseEstimated = ref(false);
const showOverlay = computed(() => firstFrameReceived.value || firstPoseEstimated.value);

// Single-shot analysis
const analyzing = ref(false);
const countdown = ref(0);
const analyzeMs = ref(0);
const analyzeKeypoints = ref<any[]>([]);
const analyzeKeypointCount = computed(() => analyzeKeypoints.value.length);

// Runtime stats (non-reactive internal counters)
let loadMs = 0;
let warmMs = 0;
let inferMs = 0;
let frameCount = 0;
let lastFrameTime = 0;
let fps = 0;

// ───────────────────────────────────────────
//  Detector lifecycle
// ───────────────────────────────────────────

onMounted(async () => {
  const t0 = Date.now();

  // 1. Initialise TFJS + WeChat WebGL
  const offscreenCanvas = wx.createOffscreenCanvas({
    type: 'webgl',
    width: 192,
    height: 192,
  });
  setupWechatPlatform({ fetchFunc, tf, webgl, canvas: offscreenCanvas });
  await tf.ready();

  // 2. Load detector
  const config = await createBlazePoseModelConfig();
  detector = await createDetector(BLAZEPOSE_MODEL_NAME as any, config as any);
  loadMs = Date.now() - t0;

  // 3. Warm-up — JIT-compile WebGL shaders
  const t1 = Date.now();
  const warmupTensor = tf.tensor3d(new Float32Array([0, 0, 0]), [1, 1, 3]);
  await detector.estimatePoses(warmupTensor);
  warmupTensor.dispose();
  warmMs = Date.now() - t1;

  // 4. Start camera
  poseCamera.value?.startCamera();
  emitStats('ready');
});

onUnmounted(() => {
  detector = null;
  poseCamera.value?.stopCamera();
});

function emitStats(status: string) {
  props.onStats({ status, loadMs, warmMs, inferMs, fps });
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
  const t0 = Date.now();
  const poses = await detector!.estimatePoses(rgbTensor, { flipHorizontal: false });
  const ms = Date.now() - t0;
  rgbTensor.dispose();
  return { poses, inferMs: ms };
}

// ───────────────────────────────────────────
//  Camera frame pump (live listener path)
// ───────────────────────────────────────────

/** Called by PoseCamera for every camera frame (throttled to ~10 fps). */
async function onFrame(frame: Frame) {
  if (!detector) return;
  const t = Date.now();

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

  const poses = await detector.estimatePoses(rgbTensor, { flipHorizontal: false });
  rgbTensor.dispose();
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
    poseCamera.value?.drawFrame(frame);
    poseCamera.value?.drawKeypoints(poses[0].keypoints);
    props.onResult({ pose: poses[0], inferMs, ts: new Date() });
  }
  emitStats('detecting');
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

    // Take photo
    const photo = await poseCamera.value.takePhoto();

    // Decode to offscreen canvas
    const offCanvas = wx.createOffscreenCanvas({ type: '2d', width: photo.width, height: photo.height });
    const offCtx = offCanvas.getContext('2d') as CanvasRenderingContext2D;
    const img = offCanvas.createImage();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err: any) => reject(new Error(err?.errMsg ?? 'photo decode failed'));
      img.src = photo.tempImagePath;
    });
    offCtx.drawImage(img as any, 0, 0, photo.width, photo.height);
    const imageData = offCtx.getImageData(0, 0, photo.width, photo.height);

    // Run inference
    const { poses, inferMs: analyzeInferMs } = await inferFromCanvas(offCanvas, photo.width, photo.height);
    analyzeMs.value = analyzeInferMs;

    // Draw frame + keypoints
    if (poses.length > 0 && poses[0].keypoints) {
      const kps = poses[0].keypoints;
      analyzeKeypoints.value = kps;
      const frame: Frame = {
        data: new Uint8Array(imageData.data.buffer),
        width: photo.width,
        height: photo.height,
      };
      poseCamera.value.drawFrame(frame);
      poseCamera.value.drawKeypoints(kps);
      firstFrameReceived.value = true;
      firstPoseEstimated.value = true;
      props.onResult({ pose: poses[0], inferMs: analyzeMs.value, ts: new Date() });
    } else {
      const frame: Frame = {
        data: new Uint8Array(imageData.data.buffer),
        width: photo.width,
        height: photo.height,
      };
      poseCamera.value.drawFrame(frame);
      firstFrameReceived.value = true;
      analyzeKeypoints.value = [];
    }
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
      break;
    case 'cameraInitError':
    case 'cameraFail':
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

defineExpose({ startDetect: () => poseCamera.value?.startCamera(), stopDetect: () => poseCamera.value?.stopCamera() });
</script>

<template>
  <!-- Camera view + overlay canvas -->
  <PoseCamera
    ref="poseCamera"
    :on-frame="onFrame"
    :on-status="onCameraStatus"
    :show-overlay="showOverlay"
  />

  <!-- Analyze button — single-shot capture -->
  <view v-if="cameraReady" class="analyze-bar">
    <button class="analyze-btn" :disabled="analyzing" @click="analyzeFrame">
      {{ countdown > 0 ? '⏳ ' + countdown + 's...' : analyzing ? '⏳ Analyzing...' : '📸 Analyze' }}
    </button>
    <view v-if="analyzeMs > 0" class="analyze-result">
      {{ analyzeMs }}ms · {{ analyzeKeypointCount }} keypoints
      <text v-if="analyzeKeypointCount === 0"> · No pose detected</text>
    </view>
  </view>

  <!-- Error indicator -->
  <view v-if="cameraError" class="camera-error">{{ cameraError }}</view>
</template>

<script lang="ts">
export default {
  options: { styleIsolation: 'shared' },
};
</script>

<style>
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
