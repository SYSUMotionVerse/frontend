<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import VisualTrainingPanel from '../../../components/training/VisualTrainingPanel.vue'
import type { TrainingModality } from '../../../domain/student/types'
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

const title = computed(() => (modality.value === 'hiit' ? 'HIIT guided flow' : 'Wushu guided flow'))

function finishSession() {
  const analysis = createCameraSessionAnalysis({
    modality: modality.value === 'hiit' ? 'hiit' : 'wushu',
    qualityScore: modality.value === 'hiit' ? 74 : 86
  })

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
  <UniTrainingPageShell>
    <VisualTrainingPanel
      :coach-label="`${title} coach`"
      :learner-label="`${title} learner view`"
      :title="title"
      @complete="finishSession"
      @interrupt="interruptSession"
    />
  </UniTrainingPageShell>
</template>
