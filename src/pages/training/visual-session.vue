<script setup lang="ts">
import { shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import VisualTrainingPanel from '../../components/training/VisualTrainingPanel.vue'
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

function setCapture(instance: unknown) {
  session.capture.value = instance as VisualTrainingCaptureApi | null
}
</script>

<template>
  <UniTrainingPageShell dock-tab="playground" :show-dock="false">
    <VisualTrainingPanel
      :ref="setCapture"
      :title="session.title.value"
      :video-title="session.exerciseVideo.value?.title ?? ''"
      :video-url="session.videoUrl.value"
      :video-loading="session.videoLoading.value"
      :video-error="session.videoError.value"
      :video-ended="session.videoEnded.value"
      :can-complete="session.canComplete.value"
      :completion-hint="session.completionHint.value"
      :recognition-enabled="session.recognitionEnabled.value"
      :recognition-fps="session.recognitionFps.value"
      :recording="session.recording.value"
      :record-seconds="session.recordSeconds.value"
      :recorded-video-path="session.recordedVideoPath.value"
      :live-pose-fps="session.livePoseFps.value"
      :pose-fallback-sampling="session.poseFallbackSampling.value"
      :completing="session.completing.value"
      @retry-video="session.retryVideo"
      @video-time-update="session.handleVideoTimeUpdate"
      @video-ended="session.handleVideoEnded"
      @video-error="session.handleVideoError"
      @start-recognition="session.startRecognition"
      @toggle-record="session.toggleRecord"
      @pose-result="session.handlePoseResult"
      @pose-stats="session.handlePoseStats"
      @complete="session.finishSession"
      @interrupt="session.interruptSession"
    />
  </UniTrainingPageShell>
</template>
