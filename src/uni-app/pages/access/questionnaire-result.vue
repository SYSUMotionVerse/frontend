<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import type { CheckpointKey } from '../../../domain/student/types'
import QuestionnaireResultCard from '../../../components/access/QuestionnaireResultCard.vue'
import { normalizeCheckpoint } from '../../../features/access/questionnaire'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const checkpoint = ref<CheckpointKey>('baseline')
const score = ref(0)
const percentage = ref(0)
const submittedAt = ref('')

onLoad((query) => {
  const nextQuery = query ?? {}
  checkpoint.value = normalizeCheckpoint(nextQuery.checkpoint?.toString())
  score.value = Number(nextQuery.score ?? 0)
  percentage.value = Number(nextQuery.percentage ?? 0)
  submittedAt.value = nextQuery.submittedAt?.toString() ?? ''
})

const scoreValue = computed(() => score.value)
const percentageValue = computed(() => percentage.value)
const submittedAtValue = computed(() => submittedAt.value)

function handleContinue() {
  store.refreshReminderEligibility()
  void uni.redirectTo({
    url: '/pages/training/home'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A3"
    title="Questionnaire Result"
    subtitle="Your checkpoint result is ready. Review it, then continue to the daily hub."
  >
    <QuestionnaireResultCard
      :checkpoint="checkpoint"
      :score="scoreValue"
      :percentage="percentageValue"
      :submitted-at="submittedAtValue"
      @continue="handleContinue"
    />
  </UniAccessPageShell>
</template>
