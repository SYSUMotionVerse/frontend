<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import PoseDetectionView from './pose/PoseDetectionView.vue'
import WorkoutTimeline from './WorkoutTimeline.vue'
import type { DetectResult } from './pose/PoseDetectModel'
import type {
  VisualWorkoutPhaseKind,
  VisualWorkoutState
} from '../../../features/training/visualWorkoutTimeline'
import { startCueCountdownSeconds } from '../../../features/training/visualWorkoutTimeline'

const props = defineProps<{
  videoTitle: string
  videoUrl: string
  videoLoading: boolean
  videoError: string
  videoEnded: boolean
  completionHint: string
  recognitionEnabled: boolean
  recognitionFps: 5 | 10
  recording: boolean
  recordSeconds: number
  recordedVideoPath: string
  livePoseFps: number
  poseFallbackSampling: boolean
  completing: boolean
  completionError: string
  workoutState: VisualWorkoutState
  workoutTimelineReady: boolean
  videoAutoplay: boolean
  trainingStarted: boolean
  startCountdown: number
  phaseKind: VisualWorkoutPhaseKind
  phaseRemainingSeconds: number
  comparisonMode: boolean
  // Tutorial props
  tutorialMode: boolean
  tutorialIndex: number
  tutorialText: string
  tutorialRecords: { id: number; score: number | null; comment: string; status: string; created_at: string }[]
  tutorialLoading: boolean
  tutorialVideoUrl: string
  tutorialVideoTitle: string
  tutorialTotalActions: number
  tutorialIsLast: boolean
}>()

const emit = defineEmits<{
  retryVideo: []
  videoTimeUpdate: [event: unknown]
  videoPlay: []
  videoPause: []
  videoEnded: [event: unknown]
  videoError: []
  startRecognition: [fps: 5 | 10]
  startTraining: []
  togglePlayback: []
  poseResult: [result: DetectResult]
  poseStats: [stats: { status: string; loadMs: number; warmMs: number; inferMs: number; fps: number }]
  complete: []
  interrupt: []
  // Tutorial emits
  nextTutorial: []
  prevTutorial: []
  startPractice: []
  skipTutorial: []
}>()

const poseCamera = shallowRef<InstanceType<typeof PoseDetectionView> | null>(null)
type ActiveMedia = 'demonstration' | 'camera'
const activeMedia = shallowRef<ActiveMedia>('demonstration')
const cameraViewRequested = shallowRef(false)
const cameraStartRequested = shallowRef(false)
const componentInstance = getCurrentInstance()
const POSE_MOUNT_DELAY_MS = 500
const poseMountReady = shallowRef(false)
let poseMountTimer: ReturnType<typeof setTimeout> | null = null
const showingCamera = computed(() => activeMedia.value === 'camera')
const demonstrationPrimary = computed(() => props.comparisonMode || !showingCamera.value)
const cameraPlaceholderLabel = computed(() =>
  props.recognitionEnabled ? '正在准备你的画面…' : '正在启动摄像头…'
)
const startActionDisabled = computed(() => !props.recognitionEnabled)
const showStartAction = computed(() =>
  !props.videoLoading
  && !props.videoError
  && Boolean(props.videoUrl)
  && props.phaseKind === 'preview'
  && !props.trainingStarted
  && props.startCountdown === 0
)
const poseStatusLabel = computed(() => {
  if (props.poseFallbackSampling) {
    return props.livePoseFps > 0 ? `${props.livePoseFps} FPS 采样识别` : '采样识别中'
  }
  return props.livePoseFps > 0 ? `${props.livePoseFps} FPS 实时识别` : '实时识别启动中'
})
const phaseCueCount = computed(() => {
  if (props.phaseRemainingSeconds <= 0) return null
  if (props.phaseKind === 'active') {
    const countdownDuration = props.workoutState.current.countdownDuration
    return countdownDuration > 0 && props.phaseRemainingSeconds <= countdownDuration
      ? props.phaseRemainingSeconds
      : null
  }
  if (props.phaseKind !== 'preview' && props.phaseKind !== 'countdown') return null
  return props.phaseRemainingSeconds <= startCueCountdownSeconds
    ? props.phaseRemainingSeconds
    : null
})
const phaseCueLabel = computed(() => props.phaseKind === 'active' ? '结束' : '开始')
const phaseKicker = computed(() => props.phaseKind === 'preview' ? '准备第一个动作' : '休息，准备下一个动作')
const restNextTitle = computed(() =>
  props.workoutState.current.title.replace(/^休息，准备：/, '')
)

function requestCameraStart() {
  if (props.recognitionEnabled || cameraStartRequested.value) return
  cameraStartRequested.value = true
  emit('startRecognition', 5)
}

watch(
  () => props.recognitionEnabled,
  (enabled, previous) => {
    if (poseMountTimer) {
      clearTimeout(poseMountTimer)
      poseMountTimer = null
    }
    poseMountReady.value = false
    if (!enabled) {
      if (showingCamera.value) activeMedia.value = 'demonstration'
      if (previous === true) requestCameraStart()
      return
    }

    cameraStartRequested.value = false
    if (cameraViewRequested.value) {
      activeMedia.value = 'camera'
      cameraViewRequested.value = false
    }

    poseMountTimer = setTimeout(() => {
      poseMountTimer = null
      if (props.recognitionEnabled) poseMountReady.value = true
    }, POSE_MOUNT_DELAY_MS)
  },
  { immediate: true }
)

watch(
  () => props.comparisonMode,
  (enabled) => {
    if (enabled) requestCameraStart()
  },
  { immediate: true }
)

onMounted(requestCameraStart)

onUnmounted(() => {
  if (poseMountTimer) clearTimeout(poseMountTimer)
})

function syncVideoPlayback(resetToStart = false) {
  if (typeof uni === 'undefined' || typeof uni.createVideoContext !== 'function') return
  const context = uni.createVideoContext(
    'follow-along-video',
    componentInstance?.proxy as never
  )
  if (resetToStart) context.seek(0)
  if (props.videoAutoplay) {
    context.play()
  } else {
    context.pause()
  }
}

watch(
  () => [props.videoAutoplay, props.videoUrl, props.phaseKind] as const,
  async ([, , phaseKind], previous) => {
    await nextTick()
    syncVideoPlayback(
      (phaseKind === 'active' || phaseKind === 'demonstration')
      && previous?.[2] !== phaseKind
    )
  }
)

async function startRecord() {
  const camera = poseCamera.value
  if (!camera) return

  const shouldResumeVideo = props.videoAutoplay
  await camera.startRecord()
  if (shouldResumeVideo && props.videoAutoplay) {
    await nextTick()
    syncVideoPlayback()
  }
}

async function stopRecord() {
  const camera = poseCamera.value
  if (!camera) return ''

  const shouldResumeVideo = props.videoAutoplay
  const recordedPath = await camera.stopRecord() ?? ''
  if (shouldResumeVideo && props.videoAutoplay) {
    await nextTick()
    syncVideoPlayback()
  }
  return recordedPath
}

function selectMedia(media: ActiveMedia) {
  if (media === 'demonstration') {
    cameraViewRequested.value = false
    activeMedia.value = media
    return
  }

  if (!props.recognitionEnabled) {
    activeMedia.value = media
    if (cameraViewRequested.value) return
    cameraViewRequested.value = true
    requestCameraStart()
    return
  }
  activeMedia.value = media
}

defineExpose({ startRecord, stopRecord })
</script>

<template>
  <view
    class="visual-session"
    :class="{ 'visual-session--comparison': comparisonMode }"
  >
    <!-- ═══ Tutorial Mode ═══ -->
    <view v-if="tutorialMode" class="visual-session__tutorial">
      <view class="visual-session__tutorial-header">
        <text class="visual-session__tutorial-title">动作讲解 {{ tutorialIndex + 1 }}/{{ tutorialTotalActions }}</text>
        <text class="visual-session__tutorial-subtitle">{{ tutorialVideoTitle }}</text>
      </view>

      <view v-if="tutorialLoading" class="visual-session__tutorial-loading">
        <uni-icons type="spinner-cycle" size="20" color="#536176" />
        <text>加载讲解数据…</text>
      </view>

      <video
        v-else-if="tutorialVideoUrl"
        :key="tutorialVideoUrl"
        class="visual-session__tutorial-video"
        :src="tutorialVideoUrl"
        :title="tutorialVideoTitle"
        :controls="true"
        :show-center-play-btn="true"
        :enable-progress-gesture="true"
        :autoplay="false"
        :loop="false"
        object-fit="contain"
      />
      <view v-else class="visual-session__tutorial-no-video">
        <text>暂无讲解视频</text>
      </view>

      <scroll-view scroll-y class="visual-session__tutorial-text-panel">
        <text v-if="tutorialText" class="visual-session__tutorial-text">{{ tutorialText }}</text>
        <text v-else class="visual-session__tutorial-text visual-session__tutorial-text--empty">暂无文字讲解</text>

        <view v-if="tutorialRecords.length > 0" class="visual-session__tutorial-records">
          <text class="visual-session__tutorial-records-title">参考训记</text>
          <view
            v-for="record in tutorialRecords"
            :key="record.id"
            class="visual-session__tutorial-record"
          >
            <text class="visual-session__tutorial-record-score">{{ record.score !== null ? record.score + '分' : '待评分' }}</text>
            <text class="visual-session__tutorial-record-date">{{ record.created_at.slice(0, 10) }}</text>
            <text v-if="record.comment" class="visual-session__tutorial-record-comment">{{ record.comment }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="visual-session__tutorial-actions">
        <button
          v-if="tutorialIndex > 0"
          class="visual-session__tutorial-btn visual-session__tutorial-btn--secondary"
          type="button"
          @click="emit('prevTutorial')"
        >上一个动作</button>
        <button
          v-if="!tutorialIsLast"
          class="visual-session__tutorial-btn visual-session__tutorial-btn--secondary"
          type="button"
          @click="emit('nextTutorial')"
        >下一个动作</button>
        <button
          class="visual-session__tutorial-btn visual-session__tutorial-btn--primary"
          type="button"
          @click="emit('startPractice')"
        >开始跟练</button>
      </view>

      <button
        v-if="tutorialIndex === 0"
        class="visual-session__tutorial-skip"
        type="button"
        @click="emit('skipTutorial')"
      >
        <text>跳过讲解，直接跟练</text>
      </button>
    </view>

    <!-- ═══ Training Mode (existing) ═══ -->
    <view
      v-show="!tutorialMode"
      class="visual-session__comparison-layout"
      :class="{ 'visual-session__comparison-layout--active': comparisonMode }"
    >
      <view
        class="visual-session__stage"
        :class="{ 'visual-session__stage--comparison': comparisonMode }"
      >
      <view
        class="visual-session__demonstration-stage"
        :class="{
          'visual-session__media-stage--primary': demonstrationPrimary,
          'visual-session__media-stage--secondary': !comparisonMode && showingCamera
        }"
      >
        <view v-if="comparisonMode || showingCamera" class="visual-session__media-label">
          <uni-icons type="videocam-filled" size="14" color="#fffaf4" />
          <text>动作演示</text>
        </view>
        <view v-if="videoLoading" class="visual-session__video-state">
          <uni-icons type="spinner-cycle" size="22" color="#536176" />
          <text>正在准备训练…</text>
        </view>
        <view v-else-if="videoError || !videoUrl" class="visual-session__video-state visual-session__video-state--error">
          <uni-icons type="info-filled" size="22" color="#8c4138" />
          <text>{{ videoError || '当前训练暂未配置教学视频' }}</text>
          <button class="visual-session__retry" @click="emit('retryVideo')">重新加载</button>
        </view>
        <video
          v-else
          id="follow-along-video"
          :key="videoUrl"
          class="visual-session__video"
          :src="videoUrl"
          :title="videoTitle"
          :autoplay="videoAutoplay"
          :loop="phaseKind !== 'demonstration'"
          :controls="false"
          :show-center-play-btn="false"
          :enable-progress-gesture="false"
          :object-fit="comparisonMode ? 'contain' : 'cover'"
          @timeupdate="emit('videoTimeUpdate', $event)"
          @play="emit('videoPlay')"
          @pause="emit('videoPause')"
          @loadedmetadata="syncVideoPlayback()"
          @ended="emit('videoEnded', $event)"
          @error="emit('videoError')"
        />
        <button
          v-if="!comparisonMode && showingCamera"
          class="visual-session__secondary-switch"
          aria-label="将动作演示切换到主画面"
          hover-class="visual-session__secondary-switch--pressed"
          @click.stop="selectMedia('demonstration')"
        />
      </view>
      <view
        class="visual-session__camera-stage"
        :class="{
          'visual-session__media-stage--primary': comparisonMode || showingCamera,
          'visual-session__media-stage--secondary': !comparisonMode && !showingCamera
        }"
      >
        <view v-if="comparisonMode || !showingCamera" class="visual-session__media-label">
          <uni-icons type="camera-filled" size="14" color="#fffaf4" />
          <text>我的画面</text>
        </view>
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
        <view v-else class="visual-session__camera-placeholder">
          <uni-icons type="camera-filled" size="28" color="#fffaf4" />
          <text>{{ cameraPlaceholderLabel }}</text>
        </view>
        <view v-if="recognitionEnabled && poseMountReady" class="visual-session__pose-badge">
          {{ poseStatusLabel }}
        </view>
        <view
          v-if="recognitionEnabled && poseMountReady && (phaseKind === 'preview' || phaseKind === 'rest')"
          class="visual-session__position-guide"
        >
          <view class="visual-session__guide-head" />
          <view class="visual-session__guide-torso" />
          <view class="visual-session__guide-arm visual-session__guide-arm--left" />
          <view class="visual-session__guide-arm visual-session__guide-arm--right" />
          <view class="visual-session__guide-leg visual-session__guide-leg--left" />
          <view class="visual-session__guide-leg visual-session__guide-leg--right" />
          <text class="visual-session__guide-label">站在框内</text>
        </view>
        <button
          v-if="!comparisonMode && !showingCamera"
          class="visual-session__secondary-switch"
          aria-label="将我的画面切换到主画面"
          hover-class="visual-session__secondary-switch--pressed"
          @click.stop="selectMedia('camera')"
        />
      </view>
      <view
        v-if="demonstrationPrimary && !videoLoading && !videoError && videoUrl && phaseKind === 'preview' && trainingStarted && startCountdown === 0 && !phaseCueCount"
        class="visual-session__phase-overlay"
      >
        <text class="visual-session__phase-kicker">{{ phaseKicker }}</text>
        <text class="visual-session__phase-title">{{ videoTitle }}</text>
        <text class="visual-session__phase-remaining">{{ phaseRemainingSeconds }} 秒</text>
      </view>
      <view
        v-if="demonstrationPrimary && !videoLoading && !videoError && videoUrl && phaseKind === 'rest' && !phaseCueCount"
        class="visual-session__rest-overlay"
      >
        <text class="visual-session__rest-kicker">休息 {{ phaseRemainingSeconds }} 秒</text>
        <text class="visual-session__rest-title">下一训练步骤：{{ restNextTitle }}</text>
        <text class="visual-session__rest-copy">休息结束后先观看一次完整示范</text>
      </view>
      <view
        v-if="demonstrationPrimary && !videoLoading && !videoError && videoUrl && phaseKind === 'demonstration'"
        class="visual-session__demonstration-label"
      >
        <text class="visual-session__demonstration-kicker">动作示范</text>
        <text>先观看完整动作，暂时不用跟练</text>
      </view>
      <view
        v-if="showStartAction && !comparisonMode"
        class="visual-session__start-overlay"
      >
        <button
          class="visual-session__start-button"
          :class="{ 'visual-session__start-button--disabled': startActionDisabled }"
          :disabled="startActionDisabled"
          @click="emit('startTraining')"
        >
          <uni-icons type="play-filled" size="22" color="#fffaf4" />
          <text>开始训练</text>
        </button>
        <text class="visual-session__start-hint">
          {{ startActionDisabled ? '正在准备摄像头…' : '准备好后开始 3 秒倒计时' }}
        </text>
      </view>
      <view
        v-if="startCountdown > 0"
        class="visual-session__start-countdown"
      >
        <text class="visual-session__start-countdown-value">{{ startCountdown }}</text>
        <text class="visual-session__start-countdown-label">即将开始</text>
      </view>
      <view v-if="phaseCueCount" class="visual-session__cue-overlay">
        <text class="visual-session__cue-count">{{ phaseCueCount }}</text>
        <text class="visual-session__cue-label">{{ phaseCueLabel }}</text>
      </view>
      <view v-if="phaseKind === 'active'" class="visual-session__active-timer">
        <text class="visual-session__active-timer-label">动作剩余</text>
        <text class="visual-session__active-timer-value">{{ phaseRemainingSeconds }}s</text>
      </view>
      <view v-if="demonstrationPrimary && phaseKind === 'active'" class="visual-session__lesson-label">
        <uni-icons type="videocam-filled" size="14" color="#fffaf4" />
        <text>{{ videoTitle || '教学示范' }}</text>
      </view>
      <button
        v-if="trainingStarted && startCountdown === 0 && !videoEnded && !videoLoading && !videoError && phaseKind !== 'rest' && phaseKind !== 'countdown'"
        class="visual-session__playback-control"
        :aria-label="videoAutoplay ? '暂停训练' : '继续训练'"
        @click="emit('togglePlayback')"
      >
        <text class="visual-session__playback-symbol">{{ videoAutoplay ? 'Ⅱ' : '▶' }}</text>
      </button>

      <view v-if="videoEnded" class="visual-session__completion-overlay">
        <uni-icons
          :type="completionError ? 'info-filled' : 'spinner-cycle'"
          size="26"
          color="#fffaf4"
        />
        <text class="visual-session__completion-title">
          {{ completionError ? '结果提交失败' : '训练完成，正在生成结果' }}
        </text>
        <button
          v-if="completionError"
          class="visual-session__completion-retry"
          @click="emit('complete')"
        >
          重新提交结果
        </button>
      </view>

      </view>

      <view v-if="comparisonMode" class="visual-session__comparison-actions">
        <button
          v-if="showStartAction"
          class="visual-session__landscape-start"
          :class="{ 'visual-session__landscape-start--disabled': startActionDisabled }"
          :disabled="startActionDisabled"
          hover-class="visual-session__action--pressed"
          @click="emit('startTraining')"
        >
          <uni-icons type="play-filled" size="18" color="#fffaf4" />
          <text>开始训练</text>
        </button>
        <button
          class="visual-session__comparison-exit"
          aria-label="退出训练"
          hover-class="visual-session__action--pressed"
          @click="emit('interrupt')"
        >
          <uni-icons type="closeempty" size="18" color="#675d52" />
          <text>退出</text>
        </button>
      </view>
    </view>

    <view v-if="!comparisonMode" class="visual-session__lower-grid">
      <view class="visual-session__info-panel">
        <WorkoutTimeline
          v-if="!videoLoading && !videoError && videoUrl && workoutTimelineReady"
          :state="workoutState"
        />
        <view class="visual-session__feedback">
          <text class="visual-session__hint">{{ completionHint }}</text>
        </view>
      </view>
      <view v-if="!comparisonMode" class="visual-session__secondary-space" aria-hidden="true" />
    </view>

    <view v-if="!comparisonMode" class="visual-session__actions">
      <button
        class="visual-session__secondary"
        aria-label="退出训练"
        hover-class="visual-session__action--pressed"
        @click="emit('interrupt')"
      >
        <uni-icons type="closeempty" size="20" color="#675d52" />
        <text>退出训练</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
/* ═══ Tutorial Mode ═══ */
.visual-session__tutorial {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 24rpx;
  background: #faf8f5;
  box-sizing: border-box;
}
.visual-session__tutorial-header {
  margin-bottom: 16rpx;
}
.visual-session__tutorial-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #2a3a4a;
  display: block;
}
.visual-session__tutorial-subtitle {
  font-size: 28rpx;
  color: #536176;
  margin-top: 8rpx;
  display: block;
}
.visual-session__tutorial-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 380rpx;
  gap: 12rpx;
  color: #536176;
  font-size: 28rpx;
}
.visual-session__tutorial-video {
  width: 100%;
  height: 380rpx;
  background: #000;
  border-radius: 16rpx;
}
.visual-session__tutorial-no-video {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 380rpx;
  background: #f0ece6;
  border-radius: 16rpx;
  color: #999;
  font-size: 28rpx;
}
.visual-session__tutorial-text-panel {
  flex: 1;
  margin-top: 16rpx;
  padding: 20rpx;
  background: #fff;
  border-radius: 12rpx;
}
.visual-session__tutorial-text {
  font-size: 28rpx;
  line-height: 1.8;
  color: #3a4a5a;
  white-space: pre-wrap;
  display: block;
}
.visual-session__tutorial-text--empty {
  color: #999;
}
.visual-session__tutorial-records {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #eee;
}
.visual-session__tutorial-records-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #6a7a8a;
  display: block;
  margin-bottom: 10rpx;
}
.visual-session__tutorial-record {
  padding: 10rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.visual-session__tutorial-record-score {
  font-size: 28rpx;
  font-weight: 600;
  color: #2a8a6a;
  margin-right: 16rpx;
}
.visual-session__tutorial-record-date {
  font-size: 24rpx;
  color: #999;
}
.visual-session__tutorial-record-comment {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-top: 4rpx;
}
.visual-session__tutorial-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  padding: 0 8rpx;
}
.visual-session__tutorial-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  font-size: 30rpx;
  border-radius: 12rpx;
  border: none;
}
.visual-session__tutorial-btn--primary {
  background: #4a8a6a;
  color: #fff;
  font-weight: 600;
}
.visual-session__tutorial-btn--secondary {
  background: #e8e4df;
  color: #536176;
}
.visual-session__tutorial-skip {
  border: 0;
  background: transparent;
  text-align: center;
  padding: 16rpx;
  font-size: 26rpx;
  color: #999;
}

.visual-session {
  display: flex;
  height: auto;
  min-height: calc(100vh - 24rpx);
  flex-direction: column;
  gap: 30rpx;
  box-sizing: border-box;
  padding: 28rpx 24rpx 40rpx;
  background: #fcf7f0;
}

.visual-session__actions,
.visual-session__feedback {
  display: flex;
  align-items: center;
}

.visual-session__pose-badge,
.visual-session__lesson-label {
  border-radius: 999rpx;
  background: rgba(20, 31, 48, 0.72);
  color: #fffaf4;
  font-size: 20rpx;
  font-weight: 800;
}

.visual-session__stage {
  position: relative;
  width: 100%;
  height: 936rpx;
  aspect-ratio: 3 / 4;
  flex: 0 0 auto;
  min-height: 0;
  overflow: visible;
  border-radius: 16rpx;
  background: transparent;
}

.visual-session__comparison-layout {
  width: 100%;
  flex: 0 0 auto;
}

.visual-session__stage--comparison {
  display: flex;
  aspect-ratio: auto;
  overflow: hidden;
  background: #17263b;
  box-shadow: none;
}

.visual-session__demonstration-stage,
.visual-session__camera-stage {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #20344f;
  transition: opacity 180ms ease-out;
}

.visual-session__media-stage--primary {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  box-shadow: 0 12rpx 30rpx rgba(47, 39, 31, 0.14);
}

.visual-session__media-stage--secondary {
  position: absolute;
  top: calc(100% + 30rpx);
  right: 0;
  z-index: 5;
  width: 200rpx;
  height: 280rpx;
  border: 2rpx solid rgba(32, 52, 79, 0.18);
  box-shadow: 0 10rpx 24rpx rgba(47, 39, 31, 0.16);
}

.visual-session__video,
.visual-session__video-state {
  width: 100%;
  height: 100%;
}

.visual-session__stage--comparison .visual-session__demonstration-stage,
.visual-session__stage--comparison .visual-session__camera-stage {
  position: relative;
  inset: auto;
  z-index: auto;
  min-width: 0;
  border: 0;
  box-shadow: none;
}

.visual-session__stage--comparison .visual-session__phase-overlay,
.visual-session__stage--comparison .visual-session__demonstration-label,
.visual-session__stage--comparison .visual-session__lesson-label {
  max-width: calc(50% - 40rpx);
}

.visual-session__stage--comparison .visual-session__rest-overlay {
  right: calc(50% + 2rpx);
}

.visual-session__stage--comparison .visual-session__playback-control {
  right: calc(50% + 20rpx);
}

.visual-session__media-label {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  z-index: 8;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  border-radius: 10rpx;
  background: rgba(15, 27, 43, 0.78);
  color: #fffaf4;
  font-size: 18rpx;
  font-weight: 800;
  padding: 8rpx 12rpx;
}

.visual-session__secondary-switch {
  position: absolute;
  inset: 0;
  z-index: 10;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 16rpx;
  background: transparent;
  padding: 0;
}

.visual-session__secondary-switch::after {
  border: none;
}

.visual-session__secondary-switch--pressed {
  background: rgba(255, 250, 244, 0.12);
}

.visual-session__video-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
  background: #edf1f4;
  padding: 24rpx;
  color: #536176;
  font-size: 22rpx;
  text-align: center;
}

.visual-session__video-state--error {
  background: #fff1ed;
  color: #8c4138;
}

.visual-session__rest-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  box-sizing: border-box;
  background: #17263b;
  color: #fffaf4;
  padding: 40rpx;
  text-align: center;
}

.visual-session__rest-kicker {
  color: rgba(255, 250, 244, 0.76);
  font-size: 21rpx;
  font-weight: 800;
}

.visual-session__rest-title {
  max-width: 100%;
  margin-top: 6rpx;
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  line-height: 1.35;
}

.visual-session__rest-copy {
  margin-top: 14rpx;
  color: rgba(255, 250, 244, 0.72);
  font-size: 18rpx;
  font-weight: 700;
}

.visual-session__demonstration-label {
  position: absolute;
  left: 20rpx;
  bottom: 20rpx;
  z-index: 6;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  border-radius: 16rpx;
  background: rgba(15, 27, 43, 0.82);
  color: #fffaf4;
  font-size: 20rpx;
  font-weight: 700;
  padding: 14rpx 18rpx;
}

.visual-session__demonstration-kicker {
  margin-bottom: 4rpx;
  font-size: 24rpx;
  font-weight: 900;
}

.visual-session__phase-overlay {
  position: absolute;
  left: 20rpx;
  bottom: 20rpx;
  z-index: 6;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  max-width: calc(100% - 40rpx);
  border-radius: 16rpx;
  background: rgba(15, 27, 43, 0.78);
  color: #fffaf4;
  padding: 16rpx 20rpx;
}

.visual-session__phase-kicker {
  font-size: 22rpx;
  font-weight: 800;
}

.visual-session__phase-title {
  max-width: 100%;
  margin-top: 6rpx;
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__phase-remaining {
  margin-top: 4rpx;
  color: rgba(255, 250, 244, 0.78);
  font-size: 20rpx;
  font-weight: 700;
}

.visual-session__start-overlay,
.visual-session__start-countdown {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: rgba(15, 27, 43, 0.3);
  color: #fffaf4;
  text-align: center;
}

.visual-session__start-button,
.visual-session__landscape-start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 0;
  border-radius: 999rpx;
  background: #28766a;
  box-shadow: 0 14rpx 28rpx rgba(11, 19, 31, 0.26);
  color: #fffaf4;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.visual-session__start-button {
  min-height: 88rpx;
  padding: 24rpx 42rpx;
}

.visual-session__start-button::after,
.visual-session__landscape-start::after {
  border: none;
}

.visual-session__start-button--disabled,
.visual-session__landscape-start--disabled {
  opacity: 0.56;
}

.visual-session__start-hint {
  margin-top: 18rpx;
  color: rgba(255, 250, 244, 0.86);
  font-size: 21rpx;
  font-weight: 700;
}

.visual-session__start-countdown {
  background: rgba(15, 27, 43, 0.42);
  text-shadow: 0 4rpx 20rpx rgba(8, 15, 25, 0.72);
}

.visual-session__start-countdown-value {
  font-size: 144rpx;
  font-weight: 900;
  line-height: 1;
}

.visual-session__start-countdown-label {
  margin-top: 14rpx;
  font-size: 30rpx;
  font-weight: 900;
}

.visual-session__cue-overlay {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  pointer-events: none;
  color: #fffaf4;
  text-shadow: 0 4rpx 20rpx rgba(8, 15, 25, 0.72);
}

.visual-session__cue-count {
  font-size: 112rpx;
  font-weight: 900;
  line-height: 1;
}

.visual-session__cue-label {
  margin-top: 10rpx;
  font-size: 28rpx;
  font-weight: 900;
}

.visual-session__active-timer {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  z-index: 6;
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  border-radius: 16rpx;
  background: rgba(15, 27, 43, 0.78);
  color: #fffaf4;
  padding: 12rpx 16rpx;
}

.visual-session__active-timer-label {
  color: rgba(255, 250, 244, 0.74);
  font-size: 20rpx;
  font-weight: 800;
}

.visual-session__active-timer-value {
  font-size: 32rpx;
  font-weight: 900;
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
.visual-session__secondary::after,
.visual-session__playback-control::after,
.visual-session__completion-retry::after {
  border: none;
}

.visual-session__lesson-label {
  position: absolute;
  left: 20rpx;
  bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  max-width: calc(100% - 40rpx);
  overflow: hidden;
  padding: 7rpx 12rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__playback-control {
  position: absolute;
  right: 20rpx;
  top: 20rpx;
  z-index: 7;
  display: inline-flex;
  height: 64rpx;
  width: 64rpx;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 250, 244, 0.94);
  color: #20344f;
  font-weight: 900;
  line-height: 64rpx;
  padding: 0;
}

.visual-session__playback-symbol {
  width: 24rpx;
  font-size: 21rpx;
  line-height: 1;
  text-align: center;
}

.visual-session__lower-grid {
  display: flex;
  height: 280rpx;
  min-height: 280rpx;
  flex: 0 0 280rpx;
  align-items: stretch;
  gap: 24rpx;
}

.visual-session__info-panel {
  display: flex;
  min-width: 0;
  height: 280rpx;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  border: 2rpx solid rgba(32, 52, 79, 0.12);
  border-radius: 16rpx;
  background: #f5eee6;
  padding: 26rpx 28rpx;
}

.visual-session__secondary-space {
  width: 200rpx;
  height: 280rpx;
  min-height: 0;
  flex: 0 0 200rpx;
}

.visual-session__pose-view {
  display: block;
  width: 100%;
  height: 100%;
}

.visual-session__camera-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12rpx;
  box-sizing: border-box;
  padding: 18rpx;
  color: rgba(255, 250, 244, 0.8);
  font-size: 18rpx;
  line-height: 1.4;
  text-align: center;
}

.visual-session__pose-badge {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  z-index: 3;
  max-width: calc(100% - 16rpx);
  overflow: hidden;
  padding: 5rpx 8rpx;
  font-size: 14rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__position-guide {
  position: absolute;
  inset: 12rpx 24rpx 12rpx;
  z-index: 1;
  pointer-events: none;
  color: rgba(255, 250, 244, 0.84);
}

.visual-session__guide-head,
.visual-session__guide-torso,
.visual-session__guide-arm,
.visual-session__guide-leg {
  position: absolute;
  left: 50%;
  box-sizing: border-box;
  border: 3rpx solid currentColor;
}

.visual-session__guide-head {
  top: 4%;
  width: 30rpx;
  height: 36rpx;
  border-radius: 50%;
  transform: translateX(-50%);
}

.visual-session__guide-torso {
  top: 22%;
  width: 52rpx;
  height: 82rpx;
  border-radius: 28rpx 28rpx 18rpx 18rpx;
  transform: translateX(-50%);
}

.visual-session__guide-arm,
.visual-session__guide-leg {
  width: 0;
  border-width: 0 0 0 3rpx;
  transform-origin: top center;
}

.visual-session__guide-arm {
  top: 25%;
  height: 76rpx;
}

.visual-session__guide-arm--left {
  margin-left: -25rpx;
  transform: rotate(13deg);
}

.visual-session__guide-arm--right {
  margin-left: 25rpx;
  transform: rotate(-13deg);
}

.visual-session__guide-leg {
  top: 58%;
  height: 82rpx;
}

.visual-session__guide-leg--left {
  margin-left: -14rpx;
  transform: rotate(6deg);
}

.visual-session__guide-leg--right {
  margin-left: 14rpx;
  transform: rotate(-6deg);
}

.visual-session__guide-label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  font-size: 16rpx;
  font-weight: 900;
  text-align: center;
  text-shadow: 0 2rpx 8rpx rgba(8, 15, 25, 0.72);
}

.visual-session__completion-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 18rpx;
  box-sizing: border-box;
  background: rgba(15, 27, 43, 0.9);
  color: #fffaf4;
  padding: 40rpx;
  text-align: center;
}

.visual-session__completion-title {
  font-size: 30rpx;
  font-weight: 900;
}

.visual-session__completion-retry {
  border: 0;
  border-radius: 999rpx;
  background: #fffaf4;
  color: #20344f;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 1;
  min-height: 88rpx;
  padding: 20rpx 28rpx;
}

.visual-session__feedback {
  min-height: 34rpx;
  margin-top: 20rpx;
  justify-content: space-between;
  gap: 16rpx;
}

.visual-session__hint {
  min-width: 0;
  overflow: hidden;
  color: #6f6255;
  font-size: 24rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__actions {
  justify-content: center;
  min-height: 96rpx;
  flex-wrap: nowrap;
  gap: 16rpx;
}

.visual-session__secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 88rpx;
  flex: 1;
  border: 0;
  border-radius: 9999px;
  box-sizing: border-box;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 88rpx;
  min-width: 0;
  white-space: nowrap;
  padding: 0 26rpx;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.visual-session__comparison-exit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  width: 100%;
  min-height: 64rpx;
  border: 2rpx solid rgba(126, 105, 83, 0.14);
  border-radius: 9999px;
  box-sizing: border-box;
  background: #fffaf4;
  box-shadow: 0 6rpx 0 #e3d8ca;
  color: #554d45;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 1;
  padding: 0 12rpx;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.visual-session__secondary {
  border: 2rpx solid rgba(126, 105, 83, 0.14);
  background: #fffaf4;
  box-shadow: 0 8rpx 0 #e3d8ca;
  color: #554d45;
}

.visual-session__comparison-exit::after {
  border: none;
}

.visual-session__action--pressed {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 rgba(126, 105, 83, 0.22);
}

.visual-session--comparison {
  height: calc(100vh - 24rpx);
  min-height: calc(100vh - 24rpx);
  gap: 0;
  padding: 16rpx 20rpx 20rpx;
}

.visual-session--comparison .visual-session__comparison-layout--active {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1;
  align-items: stretch;
  gap: 16rpx;
}

.visual-session--comparison .visual-session__stage--comparison {
  height: 100%;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.visual-session--comparison .visual-session__stage--comparison .visual-session__demonstration-stage,
.visual-session--comparison .visual-session__stage--comparison .visual-session__camera-stage {
  width: auto;
  height: 100%;
  max-width: calc(50% - 10rpx);
  flex: 0 1 auto;
  aspect-ratio: 3 / 4;
  border-radius: 16rpx;
}

.visual-session--comparison .visual-session__comparison-actions {
  display: flex;
  width: 144rpx;
  min-height: 0;
  flex: 0 0 144rpx;
  align-items: stretch;
  justify-content: center;
  flex-direction: column;
  gap: 16rpx;
}

.visual-session--comparison .visual-session__landscape-start {
  width: 100%;
  min-height: 88rpx;
  flex: 0 0 auto;
  font-size: 22rpx;
  padding: 18rpx 10rpx;
}

.visual-session--comparison .visual-session__comparison-exit {
  min-height: 60rpx;
}

.visual-session--comparison .visual-session__position-guide {
  inset: 12rpx 20rpx;
}

.visual-session--comparison .visual-session__pose-badge {
  top: auto;
  right: 8rpx;
  bottom: 8rpx;
}

</style>
