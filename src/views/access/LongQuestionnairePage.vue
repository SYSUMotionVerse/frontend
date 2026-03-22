<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CheckpointKey } from '../../domain/student/types'
import AccessPageShell from '../../components/access/AccessPageShell.vue'
import LongQuestionnaireForm from '../../components/access/LongQuestionnaireForm.vue'
import {
  CHECKPOINT_LABELS,
  LONG_QUESTIONNAIRES,
  normalizeCheckpoint
} from '../../features/access/questionnaire'
import { useStudentAppState } from '../../composables/useStudentAppState'

interface SubmissionPayload {
  responses: Record<string, number>
  score: number
  percentage: number
  submittedAt: string
}

const route = useRoute()
const router = useRouter()
const { submitLongQuestionnaire } = useStudentAppState()

const checkpoint = computed<CheckpointKey>(() =>
  normalizeCheckpoint(route.params.checkpoint?.toString())
)

const checkpointLabel = computed(() => CHECKPOINT_LABELS[checkpoint.value])
const questions = computed(() => LONG_QUESTIONNAIRES[checkpoint.value])

async function handleSubmit(payload: SubmissionPayload) {
  submitLongQuestionnaire(checkpoint.value, payload.score, payload.percentage)
  await router.push({
    path: `/questionnaire-result/${checkpoint.value}`,
    query: {
      score: String(payload.score),
      percentage: String(payload.percentage),
      submittedAt: payload.submittedAt
    }
  })
}
</script>

<template>
  <AccessPageShell
    chip="A2"
    :title="`${checkpointLabel} Long Questionnaire`"
    subtitle="This checkpoint assessment is required before you can continue to training."
  >
    <LongQuestionnaireForm
      :checkpoint="checkpoint"
      :questions="questions"
      @submit="handleSubmit"
    />
  </AccessPageShell>
</template>
