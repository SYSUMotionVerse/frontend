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
const questionnaireCount = ref(1)

onLoad((query) => {
  const nextQuery = query ?? {}
  checkpoint.value = normalizeCheckpoint(nextQuery.checkpoint?.toString())
  score.value = Number(nextQuery.score ?? 0)
  percentage.value = Number(nextQuery.percentage ?? 0)
  submittedAt.value = nextQuery.submittedAt?.toString() ?? ''
  questionnaireCount.value = Math.max(1, Number(nextQuery.questionnaireCount ?? 1))
})

const scoreValue = computed(() => score.value)
const percentageValue = computed(() => percentage.value)
const submittedAtValue = computed(() => submittedAt.value)

function handleContinue() {
  store.refreshReminderEligibility()
  void uni.reLaunch({
    url: checkpoint.value === 'baseline'
      ? '/pages/access/reminder-consent'
      : '/pages/training/home'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A3"
    title="问卷结果"
    subtitle="评估结果已生成，请查阅后进入训练首页。"
  >
    <QuestionnaireResultCard
      :checkpoint="checkpoint"
      :score="scoreValue"
      :percentage="percentageValue"
      :submitted-at="submittedAtValue"
      :questionnaire-count="questionnaireCount"
      @continue="handleContinue"
    />
  </UniAccessPageShell>
</template>
