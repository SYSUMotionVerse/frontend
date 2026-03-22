<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LongQuestionnaireForm from '../../../components/access/LongQuestionnaireForm.vue'
import {
  CHECKPOINT_LABELS,
  LONG_QUESTIONNAIRES,
  normalizeCheckpoint
} from '../../../features/access/questionnaire'
import type { CheckpointKey } from '../../../domain/student/types'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { buildMiniProgramQueryString } from '../../platform/queryString'

interface SubmissionPayload {
  responses: Record<string, number>
  score: number
  percentage: number
  submittedAt: string
}

const store = useStudentStore()
const checkpoint = ref<CheckpointKey>('baseline')

onLoad((query) => {
  const nextQuery = query ?? {}
  checkpoint.value = normalizeCheckpoint(nextQuery.checkpoint?.toString())
})

const checkpointLabel = computed(() => CHECKPOINT_LABELS[checkpoint.value])
const questions = computed(() => LONG_QUESTIONNAIRES[checkpoint.value])

function handleSubmit(payload: SubmissionPayload) {
  store.submitLongQuestionnaire(checkpoint.value, payload.score, payload.percentage)
  const queryString = buildMiniProgramQueryString({
    checkpoint: checkpoint.value,
    score: String(payload.score),
    percentage: String(payload.percentage),
    submittedAt: payload.submittedAt
  })

  void uni.navigateTo({
    url: `/pages/access/questionnaire-result?${queryString}`
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A2"
    :title="`${checkpointLabel} Long Questionnaire`"
    subtitle="This checkpoint assessment is required before you can continue to training."
  >
    <LongQuestionnaireForm
      :checkpoint="checkpoint"
      :questions="questions"
      @submit="handleSubmit"
    />
  </UniAccessPageShell>
</template>
