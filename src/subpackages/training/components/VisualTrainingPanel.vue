<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import DemonstrationVideoControls from './DemonstrationVideoControls.vue'
import PoseDetectionView from './pose/PoseDetectionView.vue'
import WorkoutTimeline from './WorkoutTimeline.vue'
import type { DetectResult } from './pose/PoseDetectModel'
import type {
  VisualWorkoutPhaseKind,
  VisualWorkoutPhaseSlot,
  VisualWorkoutState
} from '../../../features/training/visualWorkoutTimeline'

const props = defineProps<{
  videoTitle: string
  videoUrl: string
  videoLoading: boolean
  videoError: string
  videoEnded: boolean
  videoProgressSeconds: number
  completionHint: string
  recognitionEnabled: boolean
  recognitionReady: boolean
  recognitionStatus: 'idle' | 'preparing' | 'ready' | 'failed'
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
  videoEventToken?: string
  trainingStarted: boolean
  startCountdown: number
  phaseKind: VisualWorkoutPhaseKind
  phaseSlot: VisualWorkoutPhaseSlot
  phaseRemainingSeconds: number
  pretrainingDurationSeconds: number
  pretrainingEmbeddedCountdownDuration: number
  comparisonMode: boolean
  comparisonMediaSize?: {
    mediaWidth: number
    mediaHeight: number
  }
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
  videoPlay: [event: unknown]
  videoPause: [event: unknown]
  videoWaiting: [event: unknown]
  videoEnded: [event: unknown]
  videoError: [event: unknown]
  startRecognition: [fps: 5 | 10]
  startTraining: []
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
const demonstrationPlaybackRate = shallowRef(1)
const cameraViewRequested = shallowRef(false)
const cameraStartRequested = shallowRef(false)
const componentInstance = getCurrentInstance()
const POSE_MOUNT_DELAY_MS = 500
const poseMountReady = shallowRef(false)
let poseMountTimer: ReturnType<typeof setTimeout> | null = null
const showingCamera = computed(() => activeMedia.value === 'camera')
const demonstrationPrimary = computed(() => props.comparisonMode || !showingCamera.value)
const cameraPlaceholderLabel = computed(() =>
  props.recognitionStatus === 'failed'
    ? '摄像头准备失败'
    : props.recognitionEnabled ? '正在准备你的画面…' : '正在启动摄像头…'
)
const startActionDisabled = computed(() => !props.recognitionReady)
const showStartAction = computed(() =>
  !props.videoLoading
  && !props.videoError
  && Boolean(props.videoUrl)
  && props.phaseKind === 'preview'
  && !props.trainingStarted
  && props.startCountdown === 0
)
const showTutorialDemonstrationControls = computed(() => (
  props.tutorialMode
  && !props.tutorialLoading
  && Boolean(props.tutorialVideoUrl)
))
const poseStatusLabel = computed(() => {
  if (props.poseFallbackSampling) {
    return props.livePoseFps > 0 ? `${props.livePoseFps} FPS 采样识别` : '采样识别中'
  }
  return props.livePoseFps > 0 ? `${props.livePoseFps} FPS 实时识别` : '实时识别启动中'
})
const phaseCueCount = computed(() => {
  if (props.phaseKind === 'countdown') {
    return props.phaseRemainingSeconds > 0 ? props.phaseRemainingSeconds : null
  }
  if (
    props.phaseKind === 'demonstration'
    && props.phaseSlot === 'pretraining'
    && props.pretrainingEmbeddedCountdownDuration > 0
  ) {
    // TTS cues are scheduled from the native video's currentTime. Deriving
    // the white countdown from the same clock prevents drift when the media
    // starts late, buffers, or emits timeupdate less frequently than the
    // wall-clock phase timer.
    const mediaProgress = Number.isFinite(props.videoProgressSeconds)
      ? Math.max(0, props.videoProgressSeconds)
      : 0
    const hasMediaProgress = mediaProgress > 0
      && props.pretrainingDurationSeconds > 0
    const remaining = hasMediaProgress
      ? props.pretrainingDurationSeconds - Math.min(
        props.pretrainingDurationSeconds,
        mediaProgress
      )
      : props.phaseRemainingSeconds
    if (remaining > 0 && remaining <= props.pretrainingEmbeddedCountdownDuration) {
      return Math.ceil(remaining)
    }
  }
  if (props.phaseRemainingSeconds <= 0) return null
  return null
})
const phaseCueLabel = computed(() => {
  if (
    props.phaseKind === 'demonstration'
    && props.phaseSlot === 'pretraining'
    && phaseCueCount.value
  ) return '正式训练开始'
  if (props.phaseSlot === 'pretraining-countdown') return '预训练开始'
  if (props.phaseSlot === 'formal-countdown') return '正式训练开始'
  return '开始'
})
const phaseKicker = computed(() => {
  if (props.phaseSlot === 'pretraining') return '预训练示范'
  if (props.phaseSlot === 'formal-training') return '正式训练'
  if (props.phaseKind === 'countdown') return phaseCueLabel.value
  return props.phaseKind === 'preview' ? '准备第一个动作' : '准备下一个动作'
})
const comparisonStatus = computed(() => {
  if (showStartAction.value && props.recognitionStatus === 'failed') {
    return {
      label: '相机未就绪',
      value: '暂不可用',
      detail: '请退出训练后重试'
    }
  }

  if (showStartAction.value && startActionDisabled.value) {
    return {
      label: '正在准备摄像头',
      value: '准备中',
      detail: '完成后即可开始'
    }
  }

  if (props.startCountdown > 0) {
    return {
      label: '即将开始',
      value: String(props.startCountdown),
      detail: '跟随提示进入动作'
    }
  }

  if (phaseCueCount.value) {
    return {
      label: phaseCueLabel.value,
      value: String(phaseCueCount.value),
      detail: props.phaseSlot === 'pretraining-countdown'
        ? '准备观看示范'
        : '准备正式跟练'
    }
  }

  if (props.phaseKind === 'active') {
    return {
      label: '动作剩余',
      value: `${props.phaseRemainingSeconds}s`,
      detail: props.videoTitle || '保持与示范同步'
    }
  }

  if (props.phaseKind === 'demonstration') {
    return {
      label: '预训练示范',
      value: `${props.phaseRemainingSeconds}s`,
      detail: props.videoTitle || '按配置展示动作示范'
    }
  }

  return {
    label: phaseKicker.value,
    value: props.trainingStarted ? `${props.phaseRemainingSeconds}s` : '准备',
    detail: props.videoTitle || '跟随动作示范'
  }
})
const comparisonMediaStyle = computed(() => {
  if (!props.comparisonMode || !props.comparisonMediaSize) return undefined
  return {
    width: `${props.comparisonMediaSize.mediaWidth}px`,
    height: `${props.comparisonMediaSize.mediaHeight}px`
  }
})
const comparisonPoseMediaSize = computed(() => {
  if (!props.comparisonMode || !props.comparisonMediaSize) return undefined
  return {
    width: props.comparisonMediaSize.mediaWidth,
    height: props.comparisonMediaSize.mediaHeight
  }
})
const tutorialMediaStyle = computed(() => {
  if (!props.comparisonMode || !props.comparisonMediaSize) return undefined
  return {
    width: `${props.comparisonMediaSize.mediaWidth}px`,
    height: `${props.comparisonMediaSize.mediaHeight}px`
  }
})

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
  if (resetToStart) {
    context.seek(0)
  } else if (
    (props.phaseKind === 'active' || props.phaseKind === 'demonstration')
    && props.videoProgressSeconds > 0
  ) {
    // Preserve the current media position when a cached source is evicted and
    // the same phase falls back to its remote URL.
    context.seek(props.videoProgressSeconds)
  }
  if (props.videoAutoplay) {
    context.play()
  } else {
    context.pause()
  }
}

function getDemonstrationVideoContext() {
  if (typeof uni === 'undefined' || typeof uni.createVideoContext !== 'function') return null
  return uni.createVideoContext(
    props.tutorialMode ? 'tutorial-video' : 'follow-along-video',
    componentInstance?.proxy as never
  )
}

function applyDemonstrationPlaybackRate() {
  const context = getDemonstrationVideoContext()
  if (!context) return
  context.playbackRate(demonstrationPlaybackRate.value)
}

function handleTrainingVideoLoadedMetadata() {
  syncVideoPlayback()
}

function handleTutorialVideoLoadedMetadata() {
  applyDemonstrationPlaybackRate()
}

function changeDemonstrationPlaybackRate(rate: number) {
  demonstrationPlaybackRate.value = rate
  applyDemonstrationPlaybackRate()
}

async function replayDemonstration() {
  if (!props.tutorialMode) return

  await nextTick()
  const context = getDemonstrationVideoContext()
  if (!context) return

  context.pause()
  context.seek(0)
  context.playbackRate(demonstrationPlaybackRate.value)
  context.play()
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

watch(
  () => [props.tutorialMode, props.tutorialVideoUrl, props.videoEventToken] as const,
  () => {
    demonstrationPlaybackRate.value = 1
  }
)

function wrapVideoEvent(event: unknown) {
  let token = props.videoEventToken
  const detail = event && typeof event === 'object'
    ? (event as { detail?: unknown }).detail
    : undefined
  if (event && typeof event === 'object') {
    const currentTarget = (event as { currentTarget?: unknown }).currentTarget
    if (currentTarget && typeof currentTarget === 'object') {
      const dataset = (currentTarget as { dataset?: unknown }).dataset
      if (dataset && typeof dataset === 'object') {
        const targetToken = (dataset as { videoToken?: unknown }).videoToken
        if (typeof targetToken === 'string' && targetToken.length > 0) {
          token = targetToken
        }
      }
    }
  }
  return {
    token,
    detail: detail && typeof detail === 'object' ? detail : undefined
  }
}

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
    <view
      v-if="tutorialMode"
      class="visual-session__tutorial"
      :class="{ 'visual-session__tutorial--comparison': comparisonMode }"
    >
      <view v-if="!comparisonMode" class="visual-session__tutorial-header">
        <text class="visual-session__tutorial-title">动作讲解 {{ tutorialIndex + 1 }}/{{ tutorialTotalActions }}</text>
        <text class="visual-session__tutorial-subtitle">{{ tutorialVideoTitle }}</text>
      </view>

      <view class="visual-session__tutorial-layout">
        <view class="visual-session__tutorial-media" :style="tutorialMediaStyle">
          <view
            v-if="tutorialLoading"
            class="visual-session__tutorial-loading"
            :style="tutorialMediaStyle"
          >
            <uni-icons type="spinner-cycle" size="20" color="#536176" />
            <text>加载讲解数据…</text>
          </view>

          <video
            v-else-if="tutorialVideoUrl"
            id="tutorial-video"
            :key="tutorialVideoUrl"
            class="visual-session__tutorial-video"
            :style="tutorialMediaStyle"
            :src="tutorialVideoUrl"
            :title="tutorialVideoTitle"
            :controls="true"
            :show-center-play-btn="true"
            :enable-progress-gesture="true"
            :autoplay="false"
            :loop="false"
            object-fit="contain"
            @loadedmetadata="handleTutorialVideoLoadedMetadata"
          />
          <view
            v-else
            class="visual-session__tutorial-no-video"
            :style="tutorialMediaStyle"
          >
            <text>暂无讲解视频</text>
          </view>
          <DemonstrationVideoControls
            v-if="showTutorialDemonstrationControls"
            :playback-rate="demonstrationPlaybackRate"
            :compact="comparisonMode"
            @replay="replayDemonstration"
            @change-playback-rate="changeDemonstrationPlaybackRate"
          />
        </view>

        <view class="visual-session__tutorial-content">
          <view v-if="comparisonMode" class="visual-session__tutorial-header visual-session__tutorial-header--comparison">
            <text class="visual-session__tutorial-title">动作讲解 {{ tutorialIndex + 1 }}/{{ tutorialTotalActions }}</text>
            <text class="visual-session__tutorial-subtitle">{{ tutorialVideoTitle }}</text>
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
      </view>
    </view>

    <!-- ═══ Training Mode (existing) ═══ -->
    <view
      v-else
      class="visual-session__comparison-layout"
      :class="{ 'visual-session__comparison-layout--active': comparisonMode }"
    >
      <view
        class="visual-session__stage"
        :class="{ 'visual-session__stage--comparison': comparisonMode }"
      >
      <view
        class="visual-session__demonstration-stage"
        :style="comparisonMediaStyle"
        :class="{
          'visual-session__media-stage--primary': demonstrationPrimary,
          'visual-session__media-stage--secondary': !comparisonMode && showingCamera
        }"
      >
        <cover-view v-if="comparisonMode || showingCamera" class="visual-session__media-label">
          动作演示
        </cover-view>
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
          :key="videoEventToken || videoUrl"
          class="visual-session__video"
          :data-video-token="videoEventToken"
          :style="comparisonMediaStyle"
          :src="videoUrl"
          :title="videoTitle"
          :autoplay="videoAutoplay"
          :loop="phaseKind !== 'demonstration'"
          :controls="false"
          :show-center-play-btn="false"
          :enable-progress-gesture="false"
          :object-fit="comparisonMode ? 'contain' : 'cover'"
          @timeupdate="emit('videoTimeUpdate', wrapVideoEvent($event))"
          @play="emit('videoPlay', wrapVideoEvent($event))"
          @pause="emit('videoPause', wrapVideoEvent($event))"
          @waiting="emit('videoWaiting', wrapVideoEvent($event))"
          @loadedmetadata="handleTrainingVideoLoadedMetadata"
          @ended="emit('videoEnded', wrapVideoEvent($event))"
          @error="emit('videoError', wrapVideoEvent($event))"
        />
        <cover-view
          v-if="!comparisonMode && showingCamera"
          class="visual-session__secondary-switch"
          aria-label="将动作演示切换到主画面"
          @tap.stop="selectMedia('demonstration')"
        ></cover-view>
      </view>
      <view
        class="visual-session__camera-stage"
        :style="comparisonMediaStyle"
        :class="{
          'visual-session__media-stage--primary': comparisonMode || showingCamera,
          'visual-session__media-stage--secondary': !comparisonMode && !showingCamera
        }"
      >
        <cover-view v-if="comparisonMode || !showingCamera" class="visual-session__media-label">
          我的画面
        </cover-view>
        <PoseDetectionView
          v-if="recognitionEnabled && poseMountReady"
          :key="`pose-${recognitionFps}`"
          ref="poseCamera"
          class="visual-session__pose-view"
          mode="production"
          :initial-fps="recognitionFps"
          :media-size="comparisonPoseMediaSize"
          :on-result="result => emit('poseResult', result)"
          :on-stats="stats => emit('poseStats', stats)"
        />
        <view v-else class="visual-session__camera-placeholder">
          <uni-icons type="camera-filled" size="28" color="#fffaf4" />
          <text>{{ cameraPlaceholderLabel }}</text>
        </view>
        <cover-view v-if="recognitionEnabled && poseMountReady" class="visual-session__pose-badge">
          {{ poseStatusLabel }}
        </cover-view>
        <cover-view
          v-if="recognitionEnabled && poseMountReady && (phaseKind === 'preview' || phaseKind === 'countdown')"
          class="visual-session__position-guide"
        >
          <cover-view class="visual-session__guide-head"></cover-view>
          <cover-view class="visual-session__guide-torso"></cover-view>
          <cover-view class="visual-session__guide-arm visual-session__guide-arm--left"></cover-view>
          <cover-view class="visual-session__guide-arm visual-session__guide-arm--right"></cover-view>
          <cover-view class="visual-session__guide-leg visual-session__guide-leg--left"></cover-view>
          <cover-view class="visual-session__guide-leg visual-session__guide-leg--right"></cover-view>
          <cover-view class="visual-session__guide-label">站在框内</cover-view>
        </cover-view>
        <cover-view
          v-if="!comparisonMode && !showingCamera"
          class="visual-session__secondary-switch"
          aria-label="将我的画面切换到主画面"
          @tap.stop="selectMedia('camera')"
        ></cover-view>
      </view>
      <cover-view
        v-if="demonstrationPrimary && !comparisonMode && !videoLoading && !videoError && videoUrl && phaseKind === 'preview' && trainingStarted && startCountdown === 0 && !phaseCueCount"
        class="visual-session__phase-overlay"
      >
        <cover-view class="visual-session__phase-kicker">{{ phaseKicker }}</cover-view>
        <cover-view class="visual-session__phase-title">{{ videoTitle }}</cover-view>
        <cover-view class="visual-session__phase-remaining">{{ phaseRemainingSeconds }} 秒</cover-view>
      </cover-view>
      <cover-view
        v-if="phaseKind === 'demonstration' && !comparisonMode && demonstrationPrimary && !videoLoading && !videoError && videoUrl"
        class="visual-session__demonstration-label"
      >
        <cover-view class="visual-session__demonstration-kicker">预训练示范</cover-view>
        <cover-view>语音讲解与示范视频同步播放</cover-view>
      </cover-view>
      <cover-view
        v-if="showStartAction && !comparisonMode"
        class="visual-session__start-overlay"
      >
        <cover-view
          v-if="!startActionDisabled"
          class="visual-session__start-button"
          @tap="emit('startTraining')"
        >
          {{ recognitionStatus === 'failed' ? '相机未就绪' : '开始训练' }}
        </cover-view>
        <cover-view
          v-else
          class="visual-session__start-button visual-session__start-button--disabled"
        >
          {{ recognitionStatus === 'failed' ? '相机未就绪' : '开始训练' }}
        </cover-view>
        <cover-view class="visual-session__start-hint">
          {{ recognitionStatus === 'failed'
            ? '相机未就绪，请退出训练后重试'
            : startActionDisabled ? '正在准备摄像头…' : '开始后按后台模块配置进入训练' }}
        </cover-view>
      </cover-view>
      <cover-view
        v-if="startCountdown > 0 && !comparisonMode"
        class="visual-session__start-countdown"
      >
        <cover-view class="visual-session__start-countdown-value">{{ startCountdown }}</cover-view>
        <cover-view class="visual-session__start-countdown-label">即将开始</cover-view>
      </cover-view>
      <cover-view v-if="phaseCueCount && !comparisonMode" class="visual-session__cue-overlay">
        <cover-view class="visual-session__cue-count">{{ phaseCueCount }}</cover-view>
        <cover-view class="visual-session__cue-label">{{ phaseCueLabel }}</cover-view>
      </cover-view>
      <cover-view v-if="phaseKind === 'active' && !comparisonMode" class="visual-session__active-timer">
        <cover-view class="visual-session__active-timer-label">动作剩余</cover-view>
        <cover-view class="visual-session__active-timer-value">{{ phaseRemainingSeconds }}s</cover-view>
      </cover-view>
      <cover-view v-if="demonstrationPrimary && phaseKind === 'active' && !comparisonMode" class="visual-session__lesson-label">
        正式训练：{{ videoTitle || '动作跟练' }}
      </cover-view>
      <cover-view v-if="videoEnded" class="visual-session__completion-overlay">
        <cover-view class="visual-session__completion-title">
          {{ completionError ? '结果提交失败' : '训练完成，正在生成结果' }}
        </cover-view>
        <cover-view
          v-if="completionError"
          class="visual-session__completion-retry"
          @tap="emit('complete')"
        >
          重新提交结果
        </cover-view>
      </cover-view>

      </view>
      <view
        v-if="comparisonMode"
        class="visual-session__comparison-actions"
      >
        <view class="visual-session__comparison-status">
          <text class="visual-session__comparison-status-label">{{ comparisonStatus.label }}</text>
          <text class="visual-session__comparison-status-value">{{ comparisonStatus.value }}</text>
          <text class="visual-session__comparison-status-detail">{{ comparisonStatus.detail }}</text>
        </view>
        <view class="visual-session__comparison-controls">
          <button
            v-if="showStartAction"
            class="visual-session__landscape-start"
            :class="{ 'visual-session__landscape-start--disabled': startActionDisabled }"
            :disabled="startActionDisabled"
            hover-class="visual-session__action--pressed"
            @click="emit('startTraining')"
          >
            <uni-icons type="play-filled" size="18" color="#fffaf4" />
            <text>{{ recognitionStatus === 'failed' ? '相机未就绪' : '开始训练' }}</text>
          </button>
          <button
            class="visual-session__comparison-exit"
            aria-label="退出训练"
            hover-class="visual-session__action--pressed"
            @click="emit('interrupt')"
          >
            <uni-icons type="closeempty" size="18" color="#3d4a5c" />
            <text>退出</text>
          </button>
        </view>
      </view>
    </view>

    <view v-if="!comparisonMode && !tutorialMode" class="visual-session__lower-grid">
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

    <view v-if="!comparisonMode && !tutorialMode" class="visual-session__actions">
      <button
        class="visual-session__secondary"
        aria-label="退出训练"
        hover-class="visual-session__secondary--pressed"
        @click="emit('interrupt')"
      >
        <uni-icons type="closeempty" size="20" color="#FF8B8B" />
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
  min-height: 0;
  padding: 24rpx;
  background: #fcf7f0;
  box-sizing: border-box;
}

.visual-session__tutorial-layout {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.visual-session__tutorial-media {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 16rpx;
}

.visual-session__tutorial-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.visual-session__tutorial-header {
  margin-bottom: 16rpx;
}

.visual-session__tutorial-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #20344f;
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
  width: 100%;
  align-items: center;
  justify-content: center;
  height: 380rpx;
  gap: 12rpx;
  color: #536176;
  font-size: 28rpx;
}
.visual-session__tutorial-video {
  display: block;
  width: 100%;
  height: 380rpx;
  background: #17263b;
  border-radius: 16rpx;
}

.visual-session__tutorial-no-video {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  height: 380rpx;
  background: #f0ece6;
  border-radius: 16rpx;
  color: #82786d;
  font-size: 28rpx;
}

.visual-session__tutorial-text-panel {
  min-height: 0;
  flex: 1;
  margin-top: 16rpx;
  padding: 20rpx;
  background: #fffaf4;
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
  color: #82786d;
}

.visual-session__tutorial-records {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #e5dbcf;
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
  border-bottom: 1rpx solid #eee5da;
}

.visual-session__tutorial-record-score {
  font-size: 28rpx;
  font-weight: 600;
  color: #2a8a6a;
  margin-right: 16rpx;
}
.visual-session__tutorial-record-date {
  font-size: 24rpx;
  color: #82786d;
}

.visual-session__tutorial-record-comment {
  font-size: 24rpx;
  color: #675d52;
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
  color: #fffaf4;
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
  color: #82786d;
}

.visual-session__tutorial-btn::after,
.visual-session__tutorial-skip::after {
  border: none;
}

.visual-session__tutorial--comparison {
  height: 100%;
  min-height: 0;
  padding: 0;
  background: transparent;
}

.visual-session__tutorial--comparison .visual-session__tutorial-layout {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-media {
  display: flex;
  width: 42%;
  min-width: 0;
  height: auto;
  flex: 0 0 auto;
  align-self: center;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  background: #17263b;
}

.visual-session__tutorial--comparison .visual-session__tutorial-loading,
.visual-session__tutorial--comparison .visual-session__tutorial-video,
.visual-session__tutorial--comparison .visual-session__tutorial-no-video {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 12px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-content {
  min-width: 0;
  height: 100%;
  flex: 1;
}

.visual-session__tutorial--comparison .visual-session__tutorial-header--comparison {
  min-width: 0;
  margin: 0 0 8px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-title {
  overflow: hidden;
  font-size: 16px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__tutorial--comparison .visual-session__tutorial-subtitle {
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session__tutorial--comparison .visual-session__tutorial-text-panel {
  min-height: 0;
  flex: 1;
  margin-top: 0;
  padding: 12px;
  border-radius: 12px;
  background: #f5eee6;
}

.visual-session__tutorial--comparison .visual-session__tutorial-text {
  font-size: 14px;
  line-height: 1.55;
}

.visual-session__tutorial--comparison .visual-session__tutorial-records {
  margin-top: 12px;
  padding-top: 10px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-records-title,
.visual-session__tutorial--comparison .visual-session__tutorial-record-score {
  font-size: 13px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-record-date,
.visual-session__tutorial--comparison .visual-session__tutorial-record-comment {
  font-size: 12px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-actions {
  min-height: 44px;
  flex: 0 0 auto;
  gap: 8px;
  margin-top: 8px;
  padding: 0;
}

.visual-session__tutorial--comparison .visual-session__tutorial-btn {
  min-height: 44px;
  height: 44px;
  min-width: 0;
  line-height: 44px;
  font-size: 14px;
  border-radius: 999px;
  padding: 0 8px;
}

.visual-session__tutorial--comparison .visual-session__tutorial-skip {
  min-height: 36px;
  flex: 0 0 auto;
  padding: 8px 0 0;
  color: #675d52;
  font-size: 12px;
  line-height: 1.2;
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
  display: block;
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

.visual-session__demonstration-label {
  position: absolute;
  left: 20rpx;
  bottom: 100rpx;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  border: 2rpx solid #FF8B8B;
  background: #FFFCF8;
  box-shadow: 0 8rpx 0 #F2C5BD;
  color: #FF8B8B;
}

.visual-session__secondary--pressed {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #F2C5BD;
}

.visual-session__comparison-exit::after {
  border: none;
}

.visual-session__action--pressed {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 rgba(126, 105, 83, 0.22);
}

.visual-session--comparison {
  height: 100%;
  min-height: 0;
  gap: 0;
  padding: 12px 16px 16px;
  background: #fcf7f0;
}

.visual-session--comparison .visual-session__comparison-layout--active {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1;
  align-items: stretch;
  gap: 12px;
}

.visual-session--comparison .visual-session__stage--comparison {
  height: 100%;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: transparent;
}

.visual-session--comparison .visual-session__stage--comparison .visual-session__demonstration-stage,
.visual-session--comparison .visual-session__stage--comparison .visual-session__camera-stage {
  width: auto;
  height: 100%;
  max-width: calc(50% - 6px);
  flex: 0 0 auto;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
}

.visual-session--comparison .visual-session__media-label {
  top: 8px;
  left: 8px;
  gap: 5px;
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 8px;
}

.visual-session--comparison .visual-session__comparison-status {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  box-sizing: border-box;
  text-align: center;
}

.visual-session__comparison-status-label {
  color: #3d4a5c;
  font-size: 12px;
  font-weight: 800;
}

.visual-session__comparison-status-value {
  color: #203042;
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
}

.visual-session__comparison-status-detail {
  display: block;
  max-width: 100%;
  max-height: 34px;
  overflow: hidden;
  color: #46556a;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  white-space: normal;
}

.visual-session--comparison .visual-session__comparison-actions {
  display: flex;
  width: 112px;
  min-height: 0;
  flex: 0 0 112px;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
  gap: 12px;
  border-radius: 16px;
  box-sizing: border-box;
  background: #f5eee6;
  box-shadow: 0 4px 0 rgba(31, 47, 71, 0.08);
  padding: 10px 8px;
}

.visual-session--comparison .visual-session__comparison-controls {
  display: flex;
  width: 100%;
  min-height: 0;
  align-items: stretch;
  flex-direction: column;
  gap: 8px;
}

.visual-session--comparison .visual-session__landscape-start {
  width: 100%;
  min-height: 48px;
  flex: 0 0 auto;
  gap: 6px;
  border-radius: 999px;
  box-shadow: 0 3px 0 #23665c;
  font-size: 12px;
  padding: 0 8px;
}

.visual-session--comparison .visual-session__comparison-exit {
  width: 100%;
  min-height: 44px;
  flex: 0 0 auto;
  gap: 4px;
  flex-direction: row;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  color: #3d4a5c;
  font-size: 12px;
  padding: 0;
}

.visual-session--comparison .visual-session__position-guide {
  inset: 12px 20px;
}

.visual-session--comparison .visual-session__pose-badge {
  top: auto;
  right: 8px;
  bottom: 8px;
}

</style>
