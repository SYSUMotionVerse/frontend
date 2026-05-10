<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import VisualTrainingPanel from '../../../components/training/VisualTrainingPanel.vue'
import type { TrainingModality } from '../../../domain/student/types'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { createCameraSessionAnalysis } from '../../platform/camera'
import PoseDetectionView from '../../components/pose/PoseDetectionView.vue'
import type { DetectResult } from '../../components/pose/PoseDetectModel'

const store = useStudentStore()
const modality = ref<TrainingModality>('wushu')
const poseCamera = ref<any>(null)

// Recording state
const recording = ref(false)
const recordSeconds = ref(0)
const recordedVideoPath = ref('')
let recordTimer: ReturnType<typeof setInterval> | null = null
const lastDetectResult = ref<DetectResult | null>(null)
const livePoseFps = ref(0)
const poseFallbackSampling = ref(false)

onLoad((query) => {
  const nextQuery = query ?? {}
  const nextModality = nextQuery.modality?.toString()
  modality.value = nextModality === 'hiit' ? 'hiit' : 'wushu'
})

onMounted(async () => {
  await nextTick()
  // Activate the camera preview immediately on page mount
  poseCamera.value?.startDetect?.()
})

const title = computed(() => (modality.value === 'hiit' ? 'HIIT 引导训练' : '武术引导训练'))

async function toggleRecord() {
  if (recording.value) {
    // Stop recording
    recording.value = false
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
    try {
      const path = await poseCamera.value.stopRecord()
      recordedVideoPath.value = path
      console.log('[Session] Recorded video:', path)
    } catch (err) {
      console.warn('[Session] stopRecord failed:', err)
    }
  } else {
    // Start recording
    recordSeconds.value = 0
    recordedVideoPath.value = ''
    try {
      await poseCamera.value.startRecord()
      recording.value = true
      recordTimer = setInterval(() => { recordSeconds.value++ }, 1000)
    } catch (err) {
      console.warn('[Session] startRecord failed:', err)
    }
  }
}

function onPoseResult(result: DetectResult) {
  lastDetectResult.value = result
}

function onPoseStats(stats: { status: string; loadMs: number; warmMs: number; inferMs: number; fps: number }) {
  poseFallbackSampling.value = stats.status === 'sampling' || stats.status === 'sampling-fallback'
  if (stats.fps > 0) {
    livePoseFps.value = stats.fps
  }
}

async function finishSession() {
  // Stop recording if active
  if (recording.value) {
    recording.value = false
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
    try {
      const path = await poseCamera.value.stopRecord()
      recordedVideoPath.value = path
      console.log('[Session] Recorded video:', path)
    } catch (err) {
      console.warn('[Session] stopRecord on finish failed:', err)
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
    const result = await studentBackendSync.syncVisualSession({
      modality: syncModality,
      durationSeconds
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

  void uni.redirectTo({
    url: '/pages/training/short-questionnaire'
  })
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
  void uni.redirectTo({
    url: '/pages/training/select'
  })
}
</script>

<template>
  <UniTrainingPageShell dock-tab="playground">
    <VisualTrainingPanel
      :coach-label="`${title} 教练`"
      :learner-label="`${title} 学员视角`"
      :title="title"
      @complete="finishSession"
      @interrupt="interruptSession"
    >
      <view class="mt-[28rpx] rounded-[40rpx] overflow-hidden h-[440rpx] bg-brand-teal/15 relative">
        <PoseDetectionView
          ref="poseCamera"
          :mode="'production'"
          :on-result="onPoseResult"
          :on-stats="onPoseStats"
        />
        <view v-if="livePoseFps > 0 && !poseFallbackSampling" class="absolute left-[16rpx] top-[16rpx] rounded-full bg-black/45 px-[14rpx] py-[6rpx] text-[20rpx] text-white">
          {{ livePoseFps }} FPS 实时识别
        </view>
        <!-- Recording control overlay -->
        <view class="absolute inset-x-0 bottom-0 flex items-center justify-center p-[12rpx]"
          :class="recording ? 'bg-red-500/60' : 'bg-black/40'">
          <button
            class="min-w-[160rpx] rounded-full border-none text-[24rpx] font-800 py-[8rpx] px-[24rpx] flex items-center justify-center gap-[8rpx]"
            :class="recording ? 'bg-red-500 text-white' : 'bg-white text-slate-800'"
            @click="toggleRecord"
          >
            <text v-if="recording" class="text-[28rpx]">⬤</text>
            <text v-else class="text-[28rpx]">●</text>
            <text>{{ recording ? '停止 ' + recordSeconds + 's' : '开始录制' }}</text>
          </button>
        </view>
        <!-- Recorded indicator -->
        <view v-if="recordedVideoPath && !recording"
          class="absolute top-[12rpx] right-[12rpx] bg-green-500/80 text-white text-[20rpx] font-700 px-[12rpx] py-[4rpx] rounded-full">
          ✅ {{ recordSeconds }}s 已录制
        </view>
      </view>
    </VisualTrainingPanel>
  </UniTrainingPageShell>
</template>
