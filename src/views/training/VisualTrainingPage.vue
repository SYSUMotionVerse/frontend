<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VisualTrainingPanel from '../../components/training/VisualTrainingPanel.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'
import type { TrainingModality } from '../../types/student'

const route = useRoute()
const router = useRouter()
const { completeTrainingSession } = useStudentAppState()

const modality = computed(() => (route.params.modality as TrainingModality) ?? 'wushu')
const title = computed(() => (modality.value === 'hiit' ? 'HIIT guided flow' : 'Wushu guided flow'))

function finishSession() {
  completeTrainingSession({
    modality: modality.value,
    qualityScore: modality.value === 'hiit' ? 74 : 86,
    summary: modality.value === 'hiit' ? 'Power is there — keep your landing softer.' : 'Great control — keep your shoulders relaxed.',
    capturedBy: 'camera'
  })

  void router.push('/questionnaires/short/post-training')
}

function interruptSession() {
  void router.push('/training/select')
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-18 px-20 py-24">
    <VisualTrainingPanel
      :coach-label="`${title} coach`"
      :learner-label="`${title} learner view`"
      :title="title"
      @complete="finishSession"
      @interrupt="interruptSession"
    />
  </main>
</template>
