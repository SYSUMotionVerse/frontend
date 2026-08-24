<script setup lang="ts">
/**
 * PoseCamera — camera frame pump for WeChat Miniprogram.
 *
 * Wraps:
 *   <camera> + wx.createCameraContext().onCameraFrame() → FrameAdapter
 *   <canvas type="2d"> overlay for landmark rendering
 *
 * Key lifecycle notes:
 *   - OffscreenCanvas must be created in onMounted (not before), after the
 *     component instance is fully mounted in the WeChat runtime.
 *   - CameraListener must be explicitly start()/stop() per-page lifecycle;
 *     it does NOT automatically stop on page exit.
 */
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, reactive } from 'vue';
import type { Frame } from './PoseDetectModel';
import { createComponentContext, getNode } from './utils';

const instance = getCurrentInstance();

type PoseMediaSize = Readonly<{
  width: number
  height: number
}>

// FrameAdapter — throttles camera frames to avoid flooding the detector.
class FrameAdapter {
  private processCb?: (frame: Frame) => void;
  private getFrameGap: () => number;
  private lastProcessTime = 0;

  constructor(getFrameGap: () => number = () => 3) {
    this.getFrameGap = getFrameGap;
  }

  onProcessFrame(cb: (frame: Frame) => void) {
    this.processCb = cb;
  }

  triggerFrame(frame: any) {
    // WeChat passes raw data as ArrayBuffer in the `data` field.
    const f: Frame = {
      width: frame.width,
      height: frame.height,
      data: new Uint8Array(frame.data as ArrayBuffer),
    };
    if (!this.processCb) return;

    const now = Date.now();
    if (!this.lastProcessTime) {
      this.lastProcessTime = now;
      this.processCb(f);
      return;
    }
    // Throttle: only process every `frameGap` frames
    const elapsed = now - this.lastProcessTime;
    const minGap = (1000 / 30) * this.getFrameGap(); // ~100ms per frame at 3-gap
    if (elapsed >= minGap) {
      this.lastProcessTime = now;
      this.processCb(f);
    }
  }
}

const props = defineProps<{
  onFrame: (frame: Frame) => void;
  onStatus?: (evt: { type: string; detail?: string }) => void;
  showOverlay?: boolean;
  targetFps?: number;
  /** Measured preview dimensions for native camera layers, in device px. */
  mediaSize?: PoseMediaSize;
}>();

const state = reactive({
  canvasW: 0,
  canvasH: 0,
  canvasDisplayW: 0,
  canvasDisplayH: 0,
  isActive: false,
  cameraError: '',
  frameCount: 0,
});

const targetFps = computed(() => Math.max(1, Math.round(props.targetFps ?? 5)))
const frameGap = computed(() => Math.max(1, Math.round(30 / targetFps.value)))
const measuredMediaSize = computed(() => {
  const size = props.mediaSize
  if (
    !size
    || !Number.isFinite(size.width)
    || !Number.isFinite(size.height)
    || size.width <= 0
    || size.height <= 0
  ) {
    return null
  }

  const width = Math.round(size.width)
  const height = Math.round(size.height)
  if (width < 1 || height < 1) return null

  return {
    width,
    height
  }
})
const nativeMediaStyle = computed(() => {
  const size = measuredMediaSize.value
  if (!size) return undefined

  return {
    width: `${size.width}px`,
    height: `${size.height}px`
  }
})
const overlayCanvasStyle = computed(() => {
  if (nativeMediaStyle.value) return nativeMediaStyle.value

  return {
    width: state.canvasDisplayW ? state.canvasDisplayW + 'px' : '100%',
    height: state.canvasDisplayH ? state.canvasDisplayH + 'px' : '100%'
  }
})
const frameAdapter = new FrameAdapter(() => frameGap.value);
let cameraContext: any = null;
let cameraListener: any = null;
let shouldStartFrameListener = false;
let cameraStartGeneration = 0;
let canvasCtx: CanvasRenderingContext2D | null = null;
let overlayCanvas: HTMLCanvasElement | null = null;

const CAMERA_READY_TIMEOUT_MS = 5000
type CameraContextWaiter = {
  resolve: (context: any) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}
const cameraContextWaiters = new Set<CameraContextWaiter>()
let cameraInitializationError = ''

onMounted(async () => {
  await nextTick();
  // Overlay canvas is optional — only needed when BlazePose keypoints are rendered.
  // Wrap in try/catch so camera still works even when canvas is hidden (v-show=false).
  try {
    const [{ node: canvasNode, width, height }] = await getNode<HTMLCanvasElement>('#pose-canvas', instance);
    overlayCanvas = canvasNode as HTMLCanvasElement;
    canvasCtx = overlayCanvas.getContext('2d') as CanvasRenderingContext2D;
    state.canvasDisplayW = width
    state.canvasDisplayH = height
  } catch {
    // Canvas not available (e.g. visual-session uses showOverlay=false) — camera still works
    overlayCanvas = null;
    canvasCtx = null;
  }

  // Wire frame adapter → parent callback
  frameAdapter.onProcessFrame((frame: Frame) => {
    state.frameCount++;
    if (state.frameCount === 1) {
      props.onStatus?.({ type: 'firstFrame', detail: `${frame.width}×${frame.height}` });
    }
    props.onFrame(frame);
  });
});

onUnmounted(() => {
  stopCamera();
  rejectCameraContextWaiters(new Error('camera component unmounted'))
});

function startCamera() {
  if (state.isActive) return;
  shouldStartFrameListener = true;
  if (!cameraContext) return;

  try {
    const generation = ++cameraStartGeneration;
    const listener = cameraContext.onCameraFrame(frameAdapter.triggerFrame.bind(frameAdapter));
    cameraListener = listener;
    listener.start({
      success: () => {
        if (
          generation !== cameraStartGeneration
          || !shouldStartFrameListener
          || cameraListener !== listener
        ) {
          listener.stop?.();
          return;
        }
        state.isActive = true;
        props.onStatus?.({ type: 'frameListenerStarted' });
      },
      fail: (err: any) => {
        if (generation !== cameraStartGeneration || cameraListener !== listener) return;
        state.cameraError = err?.errMsg ?? 'start failed';
        state.isActive = false;
        cameraListener = null;
        props.onStatus?.({ type: 'cameraFail', detail: state.cameraError });
      },
    });
  } catch (err: any) {
    state.cameraError = err?.message ?? 'createCameraContext failed';
    props.onStatus?.({ type: 'cameraFail', detail: state.cameraError });
  }
}

function stopCamera() {
  shouldStartFrameListener = false;
  cameraStartGeneration += 1;
  const listener = cameraListener;
  cameraListener = null;
  state.isActive = false;
  listener?.stop();
}

function resolveCameraContextWaiters() {
  if (!cameraContext) return
  for (const waiter of cameraContextWaiters) {
    clearTimeout(waiter.timeoutId)
    waiter.resolve(cameraContext)
  }
  cameraContextWaiters.clear()
}

function rejectCameraContextWaiters(error: Error) {
  for (const waiter of cameraContextWaiters) {
    clearTimeout(waiter.timeoutId)
    waiter.reject(error)
  }
  cameraContextWaiters.clear()
}

function waitForCameraContext(): Promise<any> {
  if (cameraContext) return Promise.resolve(cameraContext)
  if (cameraInitializationError) return Promise.reject(new Error(cameraInitializationError))

  return new Promise((resolve, reject) => {
    const waiter: CameraContextWaiter = {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        cameraContextWaiters.delete(waiter)
        reject(new Error('camera initialization timed out'))
      }, CAMERA_READY_TIMEOUT_MS)
    }
    cameraContextWaiters.add(waiter)
  })
}

function initializeCameraContext() {
  if (cameraContext) return true
  try {
    cameraContext = createComponentContext(
      instance?.proxy,
      component => wx.createCameraContext(component)
    )
    if (!cameraContext) throw new Error('createCameraContext returned no context')
    cameraInitializationError = ''
    resolveCameraContextWaiters()
    if (shouldStartFrameListener) startCamera()
    return true
  } catch (err: any) {
    cameraInitializationError = err?.message ?? 'createCameraContext failed'
    state.cameraError = cameraInitializationError
    rejectCameraContextWaiters(new Error(cameraInitializationError))
    props.onStatus?.({ type: 'cameraFail', detail: cameraInitializationError })
    return false
  }
}

/** Take a still photo from the camera — independent of the frame listener. */
function takePhoto(): Promise<{ tempImagePath: string; width: number; height: number }> {
  return takePhotoWithQuality('high')
}

async function takePhotoWithQuality(quality: 'high' | 'normal' | 'low'): Promise<{ tempImagePath: string; width: number; height: number }> {
  const context = await waitForCameraContext()
  return new Promise((resolve, reject) => {
    context.takePhoto({
      quality,
      success: (res: any) => {
        wx.getImageInfo({
          src: res.tempImagePath,
          success: (info: any) => resolve({ tempImagePath: res.tempImagePath, width: info.width, height: info.height }),
          fail: () => resolve({ tempImagePath: res.tempImagePath, width: 0, height: 0 }),
        });
      },
      fail: (err: any) => reject(new Error(err?.errMsg ?? 'takePhoto failed')),
    });
  });
}

function setOverlayFrame(width: number, height: number) {
  if (!overlayCanvas) return
  // Updating a native canvas backing size resets and reallocates its render
  // surface. Camera frames normally keep a stable size, so doing this for
  // every pose result creates avoidable native-layer churn (and can visibly
  // flash on real devices). Resize only when the incoming dimensions change.
  if (state.canvasW !== width || state.canvasH !== height) {
    overlayCanvas.width = width
    overlayCanvas.height = height
    state.canvasW = width
    state.canvasH = height
  }
  if (canvasCtx) {
    canvasCtx.clearRect(0, 0, width, height)
  }
}

/** Start recording video. */
async function startRecord(): Promise<void> {
  const context = await waitForCameraContext()
  return new Promise((resolve, reject) => {
    context.startRecord({
      success: () => resolve(),
      fail: (err: any) => reject(new Error(err?.errMsg ?? 'startRecord failed')),
    });
  });
}

/** Stop recording and return the local video file path. */
async function stopRecord(): Promise<string> {
  const context = await waitForCameraContext()
  return new Promise((resolve, reject) => {
    context.stopRecord({
      success: (res: any) => resolve(res.tempVideoPath as string),
      fail: (err: any) => reject(new Error(err?.errMsg ?? 'stopRecord failed')),
    });
  });
}

/** Draw the camera frame into the 2D canvas for landmark overlay. */
function drawFrame(frame: Frame) {
  if (!canvasCtx || !overlayCanvas) return;
  overlayCanvas.width = frame.width;
  overlayCanvas.height = frame.height;
  state.canvasW = frame.width;
  state.canvasH = frame.height;
  state.canvasDisplayW = frame.width;
  state.canvasDisplayH = frame.height;
  const imageData = canvasCtx.createImageData(frame.width, frame.height);
  imageData.data.set(frame.data);
  canvasCtx.putImageData(imageData, 0, 0);
}

/** Draw keypoint circles on the overlay canvas for visible pose feedback. */
function drawKeypoints(keypoints: Array<{ x: number; y: number; score?: number; name?: string }>) {
  if (!canvasCtx || !overlayCanvas) return;
  for (const kp of keypoints) {
    if ((kp.score ?? 0) < 0.3) continue;
    // BlazePose returns keypoints in pixel coordinates (not normalized),
    // and overlayCanvas is sized to match the input frame, so use x/y directly.
    const x = kp.x;
    const y = kp.y;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 4, 0, Math.PI * 2);
    canvasCtx.fillStyle = '#4ade80';
    canvasCtx.fill();
    canvasCtx.strokeStyle = '#166534';
    canvasCtx.lineWidth = 1;
    canvasCtx.stroke();
  }
}

/** Handle camera component initdone event — camera preview is actually ready. */
function onCameraInitDone(e: any) {
  if (!initializeCameraContext()) return
  props.onStatus?.({ type: 'cameraReady', detail: `maxZoom: ${e.detail?.maxZoom}` });
}

/** Handle camera component error — camera preview failed to initialise. */
function onCameraError(e: any) {
  cameraInitializationError = e.detail?.errMsg ?? 'camera init failed'
  state.cameraError = cameraInitializationError
  rejectCameraContextWaiters(new Error(cameraInitializationError))
  props.onStatus?.({ type: 'cameraInitError', detail: cameraInitializationError });
}

defineExpose({ startCamera, stopCamera, takePhoto, drawFrame, drawKeypoints, startRecord, stopRecord, setOverlayFrame, takePhotoWithQuality });
</script>

<template>
  <view class="pose-camera">
    <!-- WeChat camera — small frame keeps live recognition stable on iPhone preview. -->
    <camera
      class="camera-layer"
      frame-size="small"
      device-position="front"
      :style="nativeMediaStyle"
      @initdone="onCameraInitDone"
      @error="onCameraError"
    />
    <!-- 2D canvas overlay for landmark drawing -->
    <!-- Overlay canvas hidden until live frames arrive — avoids black mask over camera preview -->
    <canvas
      v-show="props.showOverlay"
      id="pose-canvas"
      class="overlay-canvas"
      type="2d"
      :style="overlayCanvasStyle"
    />
  </view>
</template>

<style scoped>
.pose-camera {
  position: relative;
  width: 100%;
  height: 100%;
}
.camera-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.overlay-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
