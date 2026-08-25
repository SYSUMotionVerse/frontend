<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { onLoad, onResize, onShow } from '@dcloudio/uni-app'
import VisualTrainingPanel from './components/VisualTrainingPanel.vue'
import type { TrainingModality } from '../../domain/student/types'
import UniTrainingPageShell from '../../uni-app/components/training/UniTrainingPageShell.vue'
import {
  createVisualComparisonLayout,
  type VisualSessionSafeAreaInsets
} from './visualSessionLayout'
import {
  useVisualTrainingSession,
  type VisualTrainingCaptureApi
} from './composables/useVisualTrainingSession'

const modality = shallowRef<Exclude<TrainingModality, 'stair'>>('wushu')
const comparisonMode = shallowRef(false)
const emptySafeAreaInsets: VisualSessionSafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
}
const viewport = shallowRef({
  width: 0,
  height: 0,
  safeAreaInsets: emptySafeAreaInsets
})
const orientationReady = shallowRef(false)
const session = useVisualTrainingSession({ modality })

const comparisonMediaSize = computed(() => {
  if (!comparisonMode.value || !viewport.value.width || !viewport.value.height) return undefined
  return createVisualComparisonLayout({
    pageWidth: viewport.value.width,
    pageHeight: viewport.value.height,
    safeAreaInsets: viewport.value.safeAreaInsets
  })
})

const comparisonPageStyle = computed(() => {
  if (!comparisonMode.value) return undefined
  const { top, right, bottom, left } = viewport.value.safeAreaInsets
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return undefined
  return {
    padding: `${top}px ${right}px ${bottom}px ${left}px`
  }
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readSafeAreaCoordinate(value: unknown, key: 'top' | 'right' | 'bottom' | 'left') {
  if (!value || typeof value !== 'object') return undefined
  const coordinate = (value as Record<string, unknown>)[key]
  return typeof coordinate === 'number' && Number.isFinite(coordinate)
    ? coordinate
    : undefined
}

function resolveSafeAreaInsets(
  windowWidth: number,
  windowHeight: number,
  safeArea: unknown
): VisualSessionSafeAreaInsets {
  const left = readSafeAreaCoordinate(safeArea, 'left')
  const right = readSafeAreaCoordinate(safeArea, 'right')
  const top = readSafeAreaCoordinate(safeArea, 'top')
  const bottom = readSafeAreaCoordinate(safeArea, 'bottom')

  return {
    left: clamp(left ?? 0, 0, windowWidth),
    right: clamp(right === undefined ? 0 : windowWidth - right, 0, windowWidth),
    top: clamp(top ?? 0, 0, windowHeight),
    bottom: clamp(bottom === undefined ? 0 : windowHeight - bottom, 0, windowHeight)
  }
}

function updateOrientation(windowWidth: number, windowHeight: number, safeArea?: unknown) {
  if (windowWidth <= 0 || windowHeight <= 0) return false
  viewport.value = {
    width: windowWidth,
    height: windowHeight,
    safeAreaInsets: resolveSafeAreaInsets(windowWidth, windowHeight, safeArea)
  }
  comparisonMode.value = windowWidth > windowHeight
  orientationReady.value = true
  return true
}

function updateNavigationBarAppearance() {
  if (typeof uni === 'undefined' || typeof uni.setNavigationBarColor !== 'function') return
  void uni.setNavigationBarColor({
    frontColor: '#000000',
    backgroundColor: '#FCF7F0'
  })
}

function getRuntimeViewport() {
  if (typeof uni === 'undefined') return undefined
  if (typeof uni.getWindowInfo === 'function') {
    const windowInfo = uni.getWindowInfo()
    if (windowInfo.windowWidth > 0 && windowInfo.windowHeight > 0) {
      return {
        width: windowInfo.windowWidth,
        height: windowInfo.windowHeight,
        safeArea: (windowInfo as { safeArea?: unknown }).safeArea
      }
    }
  }

  if (typeof uni.getSystemInfoSync === 'function') {
    const systemInfo = uni.getSystemInfoSync()
    if (systemInfo.windowWidth > 0 && systemInfo.windowHeight > 0) {
      return {
        width: systemInfo.windowWidth,
        height: systemInfo.windowHeight,
        safeArea: (systemInfo as { safeArea?: unknown }).safeArea
      }
    }
  }

  return undefined
}

function updateOrientationFromRuntime() {
  if (typeof uni === 'undefined') {
    // Browser and unit-test fallbacks have no native media layer to size.
    orientationReady.value = true
    return
  }

  const runtimeViewport = getRuntimeViewport()
  if (runtimeViewport && updateOrientation(
    runtimeViewport.width,
    runtimeViewport.height,
    runtimeViewport.safeArea
  )) {
    updateNavigationBarAppearance()
    return
  }

  // A uni runtime without either viewport API is non-native for this page.
  // Let the normal responsive layout render instead of blocking the session.
  orientationReady.value = true
}

// Resolve dimensions during setup, before WeChat creates the native video layer.
updateOrientationFromRuntime()

onLoad((query) => {
  modality.value = query?.modality?.toString() === 'hiit' ? 'hiit' : 'wushu'
  updateOrientationFromRuntime()
})

onShow(updateOrientationFromRuntime)

onResize(({ size }) => {
  if (size) {
    const runtimeViewport = getRuntimeViewport()
    updateOrientation(size.windowWidth, size.windowHeight, runtimeViewport?.safeArea)
    updateNavigationBarAppearance()
    return
  }
  updateOrientationFromRuntime()
})

watch(
  () => session.exerciseVideo.value?.title?.trim(),
  (videoTitle) => {
    if (typeof uni.setNavigationBarTitle !== 'function') return
    void uni.setNavigationBarTitle({
      title: videoTitle || '可视化训练'
    })
  },
  { immediate: true }
)

function setCapture(instance: unknown) {
  session.capture.value = instance as VisualTrainingCaptureApi | null
}
</script>

<template>
  <UniTrainingPageShell
    dock-tab="playground"
    :show-dock="false"
    :fit-viewport="true"
    access-mode="execute"
  >
    <view
      class="visual-session-page"
      :class="{ 'visual-session-page--comparison': comparisonMode }"
      :style="comparisonPageStyle"
    >
      <VisualTrainingPanel
        v-if="orientationReady"
        :ref="setCapture"
        class="visual-session-page__panel"
        :video-title="session.exerciseVideo.value?.title ?? ''"
        :video-url="session.videoUrl.value"
        :video-loading="session.videoLoading.value"
        :video-error="session.videoError.value"
        :video-ended="session.videoEnded.value"
        :completion-hint="session.completionHint.value"
        :recognition-enabled="session.recognitionEnabled.value"
        :recognition-ready="session.recognitionReady.value"
        :recognition-status="session.recognitionStatus.value"
        :recognition-fps="session.recognitionFps.value"
        :recording="session.recording.value"
        :record-seconds="session.recordSeconds.value"
        :recorded-video-path="session.recordedVideoPath.value"
        :live-pose-fps="session.livePoseFps.value"
        :pose-fallback-sampling="session.poseFallbackSampling.value"
        :completing="session.completing.value"
        :completion-error="session.completionError.value"
        :workout-state="session.workoutState.value"
        :workout-timeline-ready="session.workoutTimelineReady.value"
        :video-autoplay="session.videoAutoplay.value"
        :video-event-token="session.videoEventToken.value"
        :training-started="session.trainingStarted.value"
        :start-countdown="session.startCountdown.value"
        :phase-kind="session.phaseKind.value"
        :phase-slot="session.phaseSlot.value"
        :phase-remaining-seconds="session.phaseRemainingSeconds.value"
        :comparison-mode="comparisonMode"
        :comparison-media-size="comparisonMediaSize"
        :tutorial-mode="session.tutorialMode.value"
        :tutorial-index="session.tutorialIndex.value"
        :tutorial-text="session.tutorialText.value"
        :tutorial-records="session.tutorialRecords.value"
        :tutorial-loading="session.tutorialLoading.value"
        :tutorial-video-url="session.tutorialVideoUrl.value"
        :tutorial-video-title="session.tutorialVideo.value?.title ?? ''"
        :tutorial-total-actions="session.tutorialTotalActions.value"
        :tutorial-is-last="session.tutorialIsLast.value"
        @retry-video="session.retryVideo"
        @video-time-update="session.handleVideoTimeUpdate"
        @video-play="session.handleVideoPlay"
        @video-pause="session.handleVideoPause"
        @video-waiting="session.handleVideoWaiting"
        @video-ended="session.handleVideoEnded"
        @video-error="session.handleVideoError"
        @start-recognition="session.startRecognition"
        @start-training="session.startTraining"
        @next-tutorial="session.nextTutorial"
        @prev-tutorial="session.prevTutorial"
        @start-practice="session.startPractice"
        @skip-tutorial="session.skipTutorial"
        @pose-result="session.handlePoseResult"
        @pose-stats="session.handlePoseStats"
        @complete="session.finishSession"
        @interrupt="session.interruptSession"
      />
      <view v-else class="visual-session-page__preparing">
        <text>正在准备训练画面…</text>
      </view>
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.visual-session-page {
  display: flex;
  width: 100%;
  height: auto;
  min-height: calc(100vh - 24rpx);
  flex: 1;
  overflow: visible;
}

.visual-session-page__panel {
  display: block;
  width: 100%;
  height: auto;
  min-height: calc(100vh - 24rpx);
  flex: 1;
  overflow: visible;
}

.visual-session-page--comparison {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #fcf7f0;
}

.visual-session-page--comparison .visual-session-page__panel {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.visual-session-page__preparing {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #536176;
  font-size: 28rpx;
  font-weight: 700;
}

.visual-session-page--comparison .visual-session-page__preparing {
  color: rgba(255, 250, 244, 0.78);
}
</style>
