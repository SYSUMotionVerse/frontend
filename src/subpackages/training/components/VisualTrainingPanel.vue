<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import PoseDetectionView from './pose/PoseDetectionView.vue'
import type { DetectResult } from './pose/PoseDetectModel'

const props = defineProps<{
  title: string
  videoTitle: string
  videoUrl: string
  videoLoading: boolean
  videoError: string
  videoEnded: boolean
  canComplete: boolean
  completionHint: string
  recognitionEnabled: boolean
  recognitionFps: 5 | 10
  recording: boolean
  recordSeconds: number
  recordedVideoPath: string
  livePoseFps: number
  poseFallbackSampling: boolean
  completing: boolean
}>()

const emit = defineEmits<{
  retryVideo: []
  videoTimeUpdate: [event: unknown]
  videoEnded: [event: unknown]
  videoError: []
  startRecognition: [fps: 5 | 10]
  toggleRecord: []
  poseResult: [result: DetectResult]
  poseStats: [stats: { status: string; loadMs: number; warmMs: number; inferMs: number; fps: number }]
  complete: []
  interrupt: []
}>()

const poseCamera = shallowRef<InstanceType<typeof PoseDetectionView> | null>(null)
const POSE_MOUNT_DELAY_MS = 500
const poseMountReady = shallowRef(false)
let poseMountTimer: ReturnType<typeof setTimeout> | null = null
const recordLabel = computed(() => {
  if (props.recording) return `停止录制 ${props.recordSeconds}s`
  if (props.recognitionEnabled && !poseMountReady.value) return '相机准备中…'
  return props.recognitionEnabled ? '开始录制' : '先启动识别'
})
const cameraPlaceholderLabel = computed(() =>
  props.recognitionEnabled ? '正在释放教学视频并准备摄像头…' : '选择识别帧率后开启摄像头'
)
const poseStatusLabel = computed(() => {
  if (props.poseFallbackSampling) {
    return props.livePoseFps > 0 ? `${props.livePoseFps} FPS 采样识别` : '采样识别中'
  }
  return props.livePoseFps > 0 ? `${props.livePoseFps} FPS 实时识别` : '实时识别启动中'
})

watch(
  () => props.recognitionEnabled,
  (enabled) => {
    if (poseMountTimer) {
      clearTimeout(poseMountTimer)
      poseMountTimer = null
    }
    poseMountReady.value = false
    if (!enabled) return

    poseMountTimer = setTimeout(() => {
      poseMountTimer = null
      if (props.recognitionEnabled) poseMountReady.value = true
    }, POSE_MOUNT_DELAY_MS)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (poseMountTimer) clearTimeout(poseMountTimer)
})

async function startRecord() {
  await poseCamera.value?.startRecord()
}

async function stopRecord() {
  return await poseCamera.value?.stopRecord() ?? ''
}

defineExpose({ startRecord, stopRecord })
</script>

<template>
  <view class="visual-session">
    <view class="visual-session__header">
      <view class="visual-session__heading">
        <text class="visual-session__eyebrow">跟练课程</text>
        <text class="visual-session__title">{{ title }}</text>
      </view>
      <view class="visual-session__status" :class="{ 'visual-session__status--ready': videoEnded }">
        <text>{{ videoEnded ? '教学已完成' : '训练进行中' }}</text>
      </view>
    </view>

    <view class="visual-session__stage">
      <PoseDetectionView
        v-if="recognitionEnabled && poseMountReady"
        :key="recognitionFps"
        ref="poseCamera"
        class="visual-session__pose-view"
        mode="production"
        :initial-fps="recognitionFps"
        :on-result="result => emit('poseResult', result)"
        :on-stats="stats => emit('poseStats', stats)"
      />
      <view
        v-else
        class="visual-session__camera-placeholder"
      >
        <text>{{ cameraPlaceholderLabel }}</text>
      </view>

      <view v-if="!recognitionEnabled" class="visual-session__recognition-actions">
        <button class="visual-session__recognition-button" @click="emit('startRecognition', 5)">
          启动 5fps 识别
        </button>
        <button class="visual-session__recognition-button" @click="emit('startRecognition', 10)">
          启动 10fps 识别
        </button>
      </view>

      <view
        v-if="recognitionEnabled && poseMountReady"
        class="visual-session__pose-badge"
      >
        {{ poseStatusLabel }}
      </view>

      <view class="visual-session__coach">
        <view v-if="recognitionEnabled" class="visual-session__video-state">
          <text>识别已启动，教学视频已释放</text>
        </view>
        <view v-else-if="videoLoading" class="visual-session__video-state">
          <text>正在加载教学视频…</text>
        </view>
        <view v-else-if="videoError || !videoUrl" class="visual-session__video-state visual-session__video-state--error">
          <text>{{ videoError || '当前训练暂未配置教学视频' }}</text>
          <button class="visual-session__retry" @click="emit('retryVideo')">重新加载</button>
        </view>
        <video
          v-else
          class="visual-session__video"
          :src="videoUrl"
          :title="videoTitle"
          :controls="true"
          :show-center-play-btn="true"
          :enable-progress-gesture="false"
          object-fit="contain"
          @timeupdate="emit('videoTimeUpdate', $event)"
          @ended="emit('videoEnded', $event)"
          @error="emit('videoError')"
        />
        <view class="visual-session__coach-label">
          <text>{{ videoTitle || '教学示范' }}</text>
        </view>
      </view>
    </view>

    <view class="visual-session__feedback">
      <text class="visual-session__hint">{{ completionHint }}</text>
      <text v-if="recordedVideoPath && !recording" class="visual-session__recorded">
        已录制 {{ recordSeconds }} 秒
      </text>
    </view>

    <view class="visual-session__actions">
      <button class="visual-session__secondary" @click="emit('interrupt')">退出</button>
      <button
        class="visual-session__record"
        :class="{ 'visual-session__record--disabled': !recognitionEnabled || !poseMountReady }"
        :disabled="!recognitionEnabled || !poseMountReady"
        @click="emit('toggleRecord')"
      >
        {{ recordLabel }}
      </button>
      <button
        class="visual-session__complete"
        :class="{ 'visual-session__complete--disabled': !canComplete }"
        :disabled="!canComplete"
        @click="emit('complete')"
      >
        {{ completing ? '保存中…' : '完成训练' }}
      </button>
    </view>
  </view>
</template>

<style scoped>
.visual-session {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 20rpx;
  box-sizing: border-box;
  padding: 24rpx;
  background: #fcf7f0;
}

.visual-session__header,
.visual-session__actions,
.visual-session__feedback {
  display: flex;
  align-items: center;
}

.visual-session__header {
  justify-content: space-between;
  gap: 20rpx;
}

.visual-session__heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4rpx;
}

.visual-session__eyebrow {
  color: #8c765f;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.visual-session__title {
  color: #20344f;
  font-size: 36rpx;
  font-weight: 900;
}

.visual-session__status,
.visual-session__pose-badge,
.visual-session__coach-label {
  border-radius: 999rpx;
  background: rgba(20, 31, 48, 0.72);
  color: #fffaf4;
  font-size: 20rpx;
  font-weight: 800;
}

.visual-session__status {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
}

.visual-session__status--ready {
  background: #28766a;
}

.visual-session__stage {
  position: relative;
  flex: 1;
  min-height: 720rpx;
  overflow: hidden;
  border-radius: 40rpx;
  background: #17263b;
  box-shadow: 0 20rpx 52rpx rgba(47, 39, 31, 0.16);
}

.visual-session__pose-view {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.visual-session__camera-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: rgba(255, 250, 244, 0.72);
  font-size: 24rpx;
  font-weight: 700;
}

.visual-session__coach {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  z-index: 8;
  width: 300rpx;
  overflow: hidden;
  border: 6rpx solid rgba(255, 250, 244, 0.96);
  border-radius: 26rpx;
  background: #e8eef8;
  box-shadow: 0 16rpx 36rpx rgba(11, 19, 31, 0.28);
}

.visual-session__video,
.visual-session__video-state {
  width: 100%;
  height: 230rpx;
}

.visual-session__video-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
  padding: 24rpx;
  color: #536176;
  font-size: 22rpx;
  text-align: center;
}

.visual-session__video-state--error {
  background: #fff1ed;
  color: #8c4138;
}

.visual-session__retry {
  border: 0;
  border-radius: 999rpx;
  background: #20344f;
  color: #fffaf4;
  font-size: 20rpx;
  line-height: 1;
  padding: 14rpx 22rpx;
}

.visual-session__retry::after,
.visual-session__recognition-button::after,
.visual-session__secondary::after,
.visual-session__record::after,
.visual-session__complete::after {
  border: none;
}

.visual-session__coach-label {
  position: absolute;
  left: 12rpx;
  bottom: 12rpx;
  max-width: calc(100% - 24rpx);
  overflow: hidden;
  padding: 7rpx 12rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__recognition-actions {
  position: absolute;
  left: 24rpx;
  bottom: 24rpx;
  z-index: 7;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.visual-session__recognition-button {
  border: 0;
  border-radius: 999rpx;
  background: rgba(255, 250, 244, 0.94);
  color: #20344f;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1;
  padding: 18rpx 22rpx;
}

.visual-session__pose-badge {
  position: absolute;
  left: 24rpx;
  top: 24rpx;
  z-index: 7;
  padding: 9rpx 14rpx;
}

.visual-session__feedback {
  min-height: 42rpx;
  justify-content: space-between;
  gap: 20rpx;
}

.visual-session__hint {
  color: #6f6255;
  font-size: 22rpx;
  font-weight: 700;
}

.visual-session__recorded {
  flex-shrink: 0;
  color: #28766a;
  font-size: 22rpx;
  font-weight: 800;
}

.visual-session__actions {
  gap: 16rpx;
}

.visual-session__secondary,
.visual-session__record,
.visual-session__complete {
  height: 88rpx;
  border: 0;
  border-radius: 999rpx;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 88rpx;
  padding: 0 26rpx;
}

.visual-session__secondary {
  background: #eee6dc;
  color: #675d52;
}

.visual-session__record {
  flex: 1;
  background: #d9e7f7;
  color: #20344f;
}

.visual-session__complete {
  flex: 1.2;
  background: #28766a;
  color: #fffaf4;
}

.visual-session__record--disabled,
.visual-session__complete--disabled {
  background: #e5dfd7;
  color: #9b9187;
  opacity: 1;
}
</style>
