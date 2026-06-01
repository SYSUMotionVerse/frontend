<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import type { TrainingModality } from '../../domain/student/types'
import { createVisualSessionLayout } from '../../features/training/visualSessionLayout'
import { studentBackendSync } from '../../uni-app/api/studentBackend'
import { buildVisualPoseAnalysisPayload } from '../../uni-app/api/studentBackend'
import { reportBackendSyncError } from '../../uni-app/api/reportBackendSyncError'
import UniTrainingPageShell from '../../uni-app/components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../uni-app/composables/useStudentStore'
import { createCameraSessionAnalysis } from '../../uni-app/platform/camera'
import PoseDetectionView from '../../uni-app/components/pose/PoseDetectionView.vue'
import type { DetectResult } from '../../uni-app/components/pose/PoseDetectModel'
import type { PoseAngleFrame } from '../../uni-app/components/pose/poseAnalysis'

const store = useStudentStore()
const modality = ref<TrainingModality>('wushu')
const poseCamera = ref<any>(null)

const recording = ref(false)
const recordSeconds = ref(0)
const recordedVideoPath = ref('')
let recordTimer: ReturnType<typeof setInterval> | null = null
const lastDetectResult = ref<DetectResult | null>(null)
const poseAngleFrames = ref<PoseAngleFrame[]>([])
const livePoseFps = ref(0)
const recognitionEnabled = ref(false)
const recognitionFps = ref<5 | 10>(5)

const pageWidth = ref(375)
const pageHeight = ref(667)
const floatX = ref(0)
const floatY = ref(0)
const floatPositionInitialized = ref(false)

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

onLoad((query) => {
  const nextQuery = query ?? {}
  const nextModality = nextQuery.modality?.toString()
  modality.value = nextModality === 'hiit' ? 'hiit' : 'wushu'

  try {
    const sysInfo = uni.getSystemInfoSync()
    pageWidth.value = sysInfo.windowWidth
    pageHeight.value = sysInfo.windowHeight
  } catch {
    pageWidth.value = 375
    pageHeight.value = 667
  }
})

const title = computed(() => (modality.value === 'hiit' ? 'HIIT 引导训练' : '武术引导训练'))
const userName = computed(() => store.state.profile.name?.trim() || '学员')
const userAvatar = computed(() => store.state.profile.avatarUrl || '')
const userInitial = computed(() => {
  const name = store.state.profile.name?.trim()
  return name ? name.charAt(0) : '学'
})
const userSubtitle = computed(() => `正在进行${title.value}`)
const currentStep = ref(1)
const totalSteps = 5
const guideCollapsed = ref(false)

const guidePrimary = computed(() => (
  modality.value === 'hiit'
    ? '保持节奏均匀，核心收紧，跟随示范开始动作'
    : '请保持站姿稳定，双眼平视前方，准备开始动作'
))
const guideSecondary = computed(() => (
  modality.value === 'hiit'
    ? '膝盖对齐脚尖，落地轻一点，肩颈放松'
    : '双臂自然下垂，肩颈放松，动作发力更完整'
))
const guideCollapsedText = computed(() => (
  modality.value === 'hiit'
    ? '保持节奏与呼吸，跟随示范继续'
    : '站稳身形，跟随示范继续动作'
))

function toggleGuide() {
  guideCollapsed.value = !guideCollapsed.value
}

function startRecognition(fps: 5 | 10) {
  recognitionFps.value = fps
  livePoseFps.value = 0
  recognitionEnabled.value = true
}

const timerDisplay = computed(() => {
  const minutes = Math.floor(recordSeconds.value / 60)
  const seconds = recordSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const layoutMetrics = computed(() => createVisualSessionLayout({
  pageWidth: pageWidth.value,
  pageHeight: pageHeight.value,
  guideCollapsed: guideCollapsed.value
}))
const cameraCardHeight = computed(() => layoutMetrics.value.stageHeight)
const floatAreaWidth = computed(() => layoutMetrics.value.floatAreaWidth)
const floatAreaHeight = computed(() => layoutMetrics.value.floatAreaHeight)
const floatCardWidth = computed(() => layoutMetrics.value.floatWidth)
const floatCardHeight = computed(() => layoutMetrics.value.floatHeight)
const floatVideoHeight = computed(() => layoutMetrics.value.videoHeight)
const progressWidth = computed(() => `${(currentStep.value / totalSteps) * 100}%`)

watch(layoutMetrics, (nextLayout) => {
  const maxX = Math.max(nextLayout.floatAreaWidth - nextLayout.floatWidth - 12, 12)
  const maxY = Math.max(nextLayout.floatAreaHeight - nextLayout.floatHeight - 12, 48)

  if (!floatPositionInitialized.value) {
    floatX.value = nextLayout.floatX
    floatY.value = nextLayout.floatY
    floatPositionInitialized.value = true
    return
  }

  floatX.value = clamp(floatX.value, 12, maxX)
  floatY.value = clamp(floatY.value, 48, maxY)
}, { immediate: true })

function handleFloatChange(event: { detail?: { x?: number; y?: number } }) {
  const nextX = event.detail?.x
  const nextY = event.detail?.y

  if (typeof nextX === 'number') {
    floatX.value = nextX
  }

  if (typeof nextY === 'number') {
    floatY.value = nextY
  }
}

async function toggleRecord() {
  if (!recognitionEnabled.value || !poseCamera.value) {
    console.warn('[Session] recognition is not started; recording is disabled.')
    return
  }

  if (recording.value) {
    recording.value = false
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
    try {
      recordedVideoPath.value = await poseCamera.value.stopRecord()
      console.log('[Session] Recorded video:', recordedVideoPath.value)
    } catch (err) {
      console.warn('[Session] stopRecord failed:', err)
    }
    return
  }

  recordSeconds.value = 0
  recordedVideoPath.value = ''
  try {
    await poseCamera.value.startRecord()
    recording.value = true
    recordTimer = setInterval(() => {
      recordSeconds.value++
    }, 1000)
  } catch (err) {
    console.warn('[Session] startRecord failed:', err)
  }
}

function onPoseResult(result: DetectResult) {
  lastDetectResult.value = result
  if (result.angleFrame) {
    poseAngleFrames.value.push(result.angleFrame)
  }
}

function onPoseStats(stats: { status: string; loadMs: number; warmMs: number; inferMs: number; fps: number }) {
  if (stats.fps > 0) {
    livePoseFps.value = stats.fps
  }
}

async function finishSession() {
  if (recording.value) {
    recording.value = false
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
    try {
      recordedVideoPath.value = await poseCamera.value.stopRecord()
    } catch {
      // ignore stop failures here; session can still complete
    }
  }

  const durationSeconds = Math.max(recordSeconds.value, 30)
  const syncModality = modality.value === 'hiit' ? 'hiit' : 'wushu'
  const analysis = createCameraSessionAnalysis({
    modality: syncModality,
    qualityScore: modality.value === 'hiit' ? 74 : 86
  })

  let resolvedAnalysis = {
    qualityScore: analysis.qualityScore,
    summary: analysis.summary
  }

  try {
    const poseAnalysis = buildVisualPoseAnalysisPayload(poseAngleFrames.value)
    const result = await studentBackendSync.syncVisualSession({
      modality: syncModality,
      durationSeconds,
      ...(poseAnalysis ? { poseAnalysis } : {})
    })
    if (result.synced && result.record) {
      resolvedAnalysis = {
        qualityScore: typeof result.record.score === 'number'
          ? Math.round(result.record.score)
          : typeof result.record.score === 'string' && result.record.score.trim().length > 0
            ? Math.round(Number(result.record.score))
            : analysis.qualityScore,
        summary: result.record.comment?.trim() || analysis.summary
      }
    }
  } catch (error) {
    reportBackendSyncError('训练记录同步', error)
  }

  store.completeTrainingSession({
    modality: modality.value,
    qualityScore: resolvedAnalysis.qualityScore,
    summary: resolvedAnalysis.summary,
    capturedBy: analysis.capturedBy
  })

  void uni.redirectTo({ url: '/pages/training/short-questionnaire' })
}

function interruptSession() {
  if (recording.value) {
    recording.value = false
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
    poseCamera.value?.stopRecord().catch(() => {})
  }
  void uni.redirectTo({ url: '/pages/training/select' })
}
</script>

<template>
  <UniTrainingPageShell dock-tab="playground" :show-dock="false">
    <view class="session-page">
      <view class="session-header">
        <view class="session-header__group">
          <image
            v-if="userAvatar"
            class="session-header__avatar"
            :src="userAvatar"
            mode="aspectFill"
          />
          <view v-else class="session-header__avatar session-header__avatar--fallback">
            <text class="session-header__avatar-initial">{{ userInitial }}</text>
          </view>

          <view class="session-header__copy">
            <text class="session-header__name">{{ userName }}</text>
            <text class="session-header__subtitle">{{ userSubtitle }}</text>
          </view>
        </view>

        <view class="session-header__chip" :class="{ 'session-header__chip--live': recording }">
          <view v-if="recording" class="session-header__dot" />
          <text class="session-header__timer">{{ timerDisplay }}</text>
        </view>
      </view>

      <view class="session-stage-card" :style="{ height: cameraCardHeight + 'px' }">
        <view class="session-stage-card__video">
          <PoseDetectionView
            v-if="recognitionEnabled"
            :key="recognitionFps"
            ref="poseCamera"
            :mode="'production'"
            :initial-fps="recognitionFps"
            :on-result="onPoseResult"
            :on-stats="onPoseStats"
          />
          <camera
            v-else
            class="session-stage-card__raw-camera"
            frame-size="small"
            device-position="front"
          />
          <view v-if="!recognitionEnabled" class="session-stage-card__recognition-controls">
            <button class="session-stage-card__recognition-button" @click="startRecognition(5)">
              启动 5fps 识别
            </button>
            <button class="session-stage-card__recognition-button" @click="startRecognition(10)">
              启动 10fps 识别
            </button>
          </view>
          <view v-if="livePoseFps > 0" class="session-stage-card__pose-badge">
            {{ livePoseFps }} FPS 实时识别
          </view>
        </view>
        <view class="session-stage-card__wash" />

        <movable-area
          class="reference-area"
          :style="{
            width: floatAreaWidth + 'px',
            height: floatAreaHeight + 'px'
          }"
        >
          <movable-view
            class="reference-float"
            direction="all"
            :x="floatX"
            :y="floatY"
            @change="handleFloatChange"
            :style="{
              width: floatCardWidth + 'px',
              height: floatCardHeight + 'px'
            }"
            :animation="false"
            :inertia="false"
            :out-of-bounds="false"
            :damping="40"
          >
            <view class="reference-float__surface">
              <view class="reference-float__video-shell" :style="{ height: floatVideoHeight + 'px' }">
                <view class="reference-float__video-play">▶</view>
              </view>
              <view class="reference-guide" :class="{ 'reference-guide--collapsed': guideCollapsed }">
                <view class="reference-guide__header">
                  <text class="reference-guide__tag">训练指导</text>
                  <button class="reference-guide__toggle" @click.stop="toggleGuide">
                    {{ guideCollapsed ? '展开' : '收起' }}
                  </button>
                </view>
                <view v-if="guideCollapsed" class="reference-guide__collapsed">
                  <text class="reference-guide__collapsed-line">{{ guideCollapsedText }}</text>
                </view>
                <view v-else class="reference-guide__content">
                  <text class="reference-guide__line">{{ guidePrimary }}</text>
                  <text class="reference-guide__line reference-guide__line--secondary">{{ guideSecondary }}</text>
                  <view class="reference-guide__footer">
                    <text class="reference-guide__meta">训练进度</text>
                    <text class="reference-guide__step">{{ currentStep }} / {{ totalSteps }} 步骤</text>
                  </view>
                  <view class="reference-guide__progress-track">
                    <view class="reference-guide__progress-fill" :style="{ width: progressWidth }" />
                  </view>
                </view>
              </view>
            </view>
          </movable-view>
        </movable-area>
      </view>

      <view class="session-dock">
        <button class="session-dock__side-action" @click="interruptSession">
          <view class="session-dock__icon-bubble">
            <text class="session-dock__icon">↩</text>
          </view>
          <text class="session-dock__label">退出</text>
        </button>

        <button class="session-dock__record-action" :disabled="!recognitionEnabled" @click="toggleRecord">
          <view
            class="session-dock__record-ring"
            :class="{
              'session-dock__record-ring--idle': !recording,
              'session-dock__record-ring--active': recording
            }"
          >
            <view v-if="recording" class="session-dock__record-stop" />
            <view v-else class="session-dock__record-dot" />
          </view>
          <text class="session-dock__record-label">{{ recording ? '录制中' : recognitionEnabled ? '开始录制' : '先启动识别' }}</text>
        </button>

        <button class="session-dock__side-action" @click="finishSession">
          <view class="session-dock__icon-bubble session-dock__icon-bubble--confirm">
            <text class="session-dock__icon session-dock__icon--confirm">✓</text>
          </view>
          <text class="session-dock__label session-dock__label--confirm">完成训练</text>
        </button>
      </view>

      <view v-if="recordedVideoPath && !recording" class="session-toast">
        ✅ {{ recordSeconds }}s 已录制
      </view>
    </view>
  </UniTrainingPageShell>
</template>

<style>
.session-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-sizing: border-box;
  padding: 14rpx 24rpx 12rpx;
  background:
    radial-gradient(circle at right top, rgba(255, 210, 206, 0.82), transparent 22%),
    radial-gradient(circle at left center, rgba(220, 236, 255, 0.85), transparent 16%),
    linear-gradient(180deg, #fffaf4 0%, #fdf6ee 48%, #fbf2e7 100%);
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 8rpx;
  margin-bottom: 12rpx;
  flex-shrink: 0;
}

.session-header__group {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
  flex: 1;
}

.session-header__avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 9999px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 10rpx 24rpx rgba(199, 143, 124, 0.18);
  border: 4rpx solid rgba(255, 255, 255, 0.92);
}

.session-header__avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fda4af, #fb7185);
}

.session-header__avatar-initial {
  font-size: 26rpx;
  font-weight: 800;
  color: #fff;
}

.session-header__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3rpx;
}

.session-header__name {
  font-size: 31rpx;
  line-height: 1.15;
  font-weight: 900;
  color: #1f3253;
}

.session-header__subtitle {
  font-size: 20rpx;
  line-height: 1.35;
  font-weight: 700;
  color: #8d97ab;
}

.session-header__chip {
  margin-top: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 18rpx;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10rpx 24rpx rgba(255, 121, 145, 0.12);
  flex-shrink: 0;
}

.session-header__chip--live {
  background: rgba(255, 255, 255, 0.98);
}

.session-header__dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #ff7b8f;
  box-shadow: 0 0 0 10rpx rgba(255, 123, 143, 0.16);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.session-header__timer {
  font-size: 15rpx;
  font-weight: 900;
  color: #ff6f84;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.38; }
}

.session-stage-card {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 46rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.24);
  box-shadow: 0 22rpx 58rpx rgba(173, 145, 120, 0.16);
}

.session-stage-card__video {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.session-stage-card__pose-badge {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 4;
  border-radius: 9999rpx;
  background: rgba(15, 23, 42, 0.45);
  padding: 6rpx 14rpx;
  color: #fff;
  font-size: 20rpx;
  line-height: 1.2;
  letter-spacing: 0.04em;
}

.session-stage-card__video .pose-camera,
.session-stage-card__video .camera-layer,
.session-stage-card__raw-camera {
  width: 100% !important;
  height: 100% !important;
}

.session-stage-card__raw-camera {
  display: block;
}

.session-stage-card__recognition-controls {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 6;
  display: flex;
  gap: 10rpx;
  max-width: calc(100% - 32rpx);
}

.session-stage-card__recognition-button {
  border-radius: 9999rpx;
  background: rgba(255, 255, 255, 0.92);
  color: #1f3253;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 1.2;
  padding: 8rpx 16rpx;
}

.session-stage-card__wash {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255, 252, 247, 0.16) 0%, rgba(255, 252, 247, 0.02) 26%, rgba(255, 247, 242, 0.06) 100%),
    radial-gradient(circle at right top, rgba(255, 218, 211, 0.28), transparent 32%);
}

.reference-area {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 12;
  pointer-events: none;
}

.reference-float {
  top: 0;
  pointer-events: auto;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 18rpx 40rpx rgba(82, 66, 58, 0.18);
}

.reference-float__surface {
  width: 100%;
  height: 100%;
  padding: 10rpx;
  border-radius: 28rpx;
  background: rgba(255, 253, 251, 0.96);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow:
    inset 0 0 0 2rpx rgba(255, 240, 234, 0.92),
    0 6rpx 18rpx rgba(206, 178, 160, 0.1);
}

.reference-float__video-shell {
  position: relative;
  border-radius: 20rpx;
  background: linear-gradient(180deg, #edf3ff 0%, #e6eefb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.55);
}

.reference-float__video-play {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(147, 168, 207, 0.26);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  line-height: 1;
}

.reference-guide {
  padding: 12rpx 14rpx 14rpx;
  border-radius: 20rpx;
  background: rgba(255, 250, 248, 0.98);
  box-shadow: inset 0 0 0 2rpx rgba(255, 241, 237, 0.92);
}

.reference-guide--collapsed {
  width: calc(100% - 12rpx);
  margin: 0 auto;
  padding-bottom: 12rpx;
}

.reference-guide__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}

.reference-guide__content {
  margin-top: 10rpx;
}

.reference-guide__collapsed {
  margin-top: 8rpx;
}

.reference-guide__tag {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 14rpx;
  border-radius: 9999px;
  font-size: 17rpx;
  font-weight: 900;
  color: #ff7d8c;
  background: linear-gradient(180deg, #fff0f1, #ffe6eb);
}

.reference-guide__toggle {
  border: none;
  background: rgba(255, 240, 239, 0.95);
  color: #f37d89;
  border-radius: 9999px;
  font-size: 14rpx;
  font-weight: 800;
  padding: 6rpx 14rpx;
  line-height: 1;
}

.reference-guide__line {
  display: block;
  font-size: 16rpx;
  line-height: 1.42;
  font-weight: 800;
  color: #607089;
}

.reference-guide__line--secondary {
  margin-top: 6rpx;
  color: #8795aa;
  font-weight: 700;
}

.reference-guide__collapsed-line {
  display: block;
  font-size: 15rpx;
  line-height: 1.4;
  font-weight: 800;
  color: #73829a;
  text-align: center;
}

.reference-guide__footer {
  margin-top: 10rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6rpx;
}

.reference-guide__meta,
.reference-guide__step {
  font-size: 16rpx;
  font-weight: 800;
  color: #a4aec0;
}

.reference-guide__progress-track {
  margin-top: 8rpx;
  height: 7rpx;
  border-radius: 9999px;
  background: #ecedf3;
  overflow: hidden;
}

.reference-guide__progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, #ff9aa4, #ff7588);
}

.session-dock {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 12rpx;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 22rpx 16rpx;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(22rpx);
  border-radius: 44rpx;
  box-shadow: 0 14rpx 36rpx rgba(155, 125, 103, 0.14);
}

.session-dock__side-action {
  position: relative;
  width: 118rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  border: none;
  background: transparent;
  padding: 0;
  line-height: 1;
  border-radius: 0;
}

.session-dock__side-action::after {
  border: none;
}

.session-dock__icon-bubble {
  width: 62rpx;
  height: 62rpx;
  border-radius: 9999px;
  background: #f8fbff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 0 0 2rpx rgba(200, 210, 226, 0.45),
    0 8rpx 20rpx rgba(198, 183, 170, 0.16);
}

.session-dock__icon-bubble--confirm {
  background: #fbfffc;
}

.session-dock__icon {
  font-size: 30rpx;
  line-height: 1;
  color: #41516b;
}

.session-dock__icon--confirm {
  color: #22a04f;
}

.session-dock__label {
  font-size: 18rpx;
  font-weight: 800;
  color: #2b3d56;
}

.session-dock__label--confirm {
  color: #21364f;
}

.session-dock__record-action {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  border: none;
  background: transparent;
  padding: 0;
  margin-top: -34rpx;
  line-height: 1;
  border-radius: 0;
}

.session-dock__record-action::after {
  border: none;
}

.session-dock__record-ring {
  width: 86rpx;
  height: 86rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 30rpx rgba(255, 118, 140, 0.28);
}

.session-dock__record-ring--idle,
.session-dock__record-ring--active {
  background: linear-gradient(180deg, #ff9aa7, #ff6e82);
}

.session-dock__record-dot {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: #fff;
}

.session-dock__record-stop {
  width: 32rpx;
  height: 32rpx;
  border-radius: 8rpx;
  background: #fff;
}

.session-dock__record-label {
  font-size: 18rpx;
  font-weight: 900;
  color: #ff6b82;
}

.session-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 30;
  padding: 14rpx 28rpx;
  border-radius: 9999px;
  background: rgba(28, 175, 92, 0.9);
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
  box-shadow: 0 14rpx 32rpx rgba(28, 175, 92, 0.22);
  pointer-events: none;
}
</style>
