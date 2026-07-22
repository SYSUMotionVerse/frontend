<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import VisualTrainingPanel from './components/VisualTrainingPanel.vue'
import type { TrainingModality } from '../../domain/student/types'
import UniTrainingPageShell from '../../uni-app/components/training/UniTrainingPageShell.vue'
import {
  useVisualTrainingSession,
  type VisualTrainingCaptureApi
} from '../../uni-app/composables/useVisualTrainingSession'

const modality = shallowRef<Exclude<TrainingModality, 'stair'>>('wushu')
const session = useVisualTrainingSession({ modality })

onLoad((query) => {
  modality.value = query?.modality?.toString() === 'hiit' ? 'hiit' : 'wushu'
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
  <UniTrainingPageShell dock-tab="playground" :show-dock="false" :fit-viewport="true">
    <view class="visual-session-page">
      <VisualTrainingPanel
        :ref="setCapture"
        class="visual-session-page__panel"
        :video-title="session.exerciseVideo.value?.title ?? ''"
        :video-url="session.videoUrl.value"
        :video-loading="session.videoLoading.value"
        :video-error="session.videoError.value"
        :video-ended="session.videoEnded.value"
        :completion-hint="session.completionHint.value"
        :recognition-enabled="session.recognitionEnabled.value"
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
        :training-started="session.trainingStarted.value"
        :start-countdown="session.startCountdown.value"
        :phase-kind="session.phaseKind.value"
        :phase-remaining-seconds="session.phaseRemainingSeconds.value"
        @retry-video="session.retryVideo"
        @video-time-update="session.handleVideoTimeUpdate"
        @video-play="session.handleVideoPlay"
        @video-pause="session.handleVideoPause"
        @video-ended="session.handleVideoEnded"
        @video-error="session.handleVideoError"
        @toggle-playback="session.togglePlayback"
        @start-recognition="session.startRecognition"
        @start-training="session.startTraining"
        @toggle-record="session.toggleRecord"
        @pose-result="session.handlePoseResult"
        @pose-stats="session.handlePoseStats"
        @complete="session.finishSession"
        @interrupt="session.interruptSession"
      />
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
</style>
