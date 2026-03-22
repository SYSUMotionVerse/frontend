<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CheckpointKey } from '../../domain/student/types'
import AccessPageShell from '../../components/access/AccessPageShell.vue'
import QuestionnaireResultCard from '../../components/access/QuestionnaireResultCard.vue'
import { normalizeCheckpoint } from '../../features/access/questionnaire'
import { useStudentAppState } from '../../composables/useStudentAppState'

const route = useRoute()
const router = useRouter()
const { refreshReminderEligibility } = useStudentAppState()

const checkpoint = computed<CheckpointKey>(() =>
  normalizeCheckpoint(route.params.checkpoint?.toString())
)

const score = computed(() => Number(route.query.score ?? 0))
const percentage = computed(() => Number(route.query.percentage ?? 0))
const submittedAt = computed(() => route.query.submittedAt?.toString() ?? '')

async function handleContinue() {
  refreshReminderEligibility()
  await router.push('/home')
}
</script>

<template>
  <AccessPageShell
    chip="A3"
    title="Questionnaire Result"
    subtitle="Your checkpoint result is ready. Review it, then continue to the daily hub."
  >
    <QuestionnaireResultCard
      :checkpoint="checkpoint"
      :score="score"
      :percentage="percentage"
      :submitted-at="submittedAt"
      @continue="handleContinue"
    />
  </AccessPageShell>
</template>
