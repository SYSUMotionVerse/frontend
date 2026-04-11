<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import VisualTrainingPanel from '../../../components/training/VisualTrainingPanel.vue'
import type { TrainingModality } from '../../../domain/student/types'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { createCameraSessionAnalysis } from '../../platform/camera'

const store = useStudentStore()
const modality = ref<TrainingModality>('wushu')

onLoad((query) => {
  const nextQuery = query ?? {}
  const nextModality = nextQuery.modality?.toString()
  modality.value = nextModality === 'hiit' ? 'hiit' : 'wushu'
})

const title = computed(() => (modality.value === 'hiit' ? 'HIIT 引导训练' : '武术引导训练'))

async function finishSession() {
  const durationSeconds = 30
  const syncModality = modality.value === 'hiit' ? 'hiit' : 'wushu'
  const analysis = createCameraSessionAnalysis({
    modality: syncModality,
    qualityScore: modality.value === 'hiit' ? 74 : 86
  })

  try {
    await studentBackendSync.syncVisualSession({
      modality: syncModality,
      durationSeconds
    })
  } catch (error) {
    reportBackendSyncError('训练记录同步', error)
  }

  store.completeTrainingSession({
    modality: modality.value,
    qualityScore: analysis.qualityScore,
    summary: analysis.summary,
    capturedBy: analysis.capturedBy
  })

  void uni.redirectTo({
    url: '/pages/training/short-questionnaire'
  })
}

function interruptSession() {
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
    />
  </UniTrainingPageShell>
</template>
