<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import AssessmentHistoryList from '../../../components/growth/AssessmentHistoryList.vue'
import TrainingHistoryList from '../../../components/growth/TrainingHistoryList.vue'
import type {
  GrowthAssessmentHistoryItem,
  GrowthTrainingHistoryItem
} from '../../api/studentBackendTypes'
import { studentBackendSync } from '../../api/studentBackend'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { CHECKPOINT_LABELS } from '../../../features/access/questionnaire'

const store = useStudentStore()
const backendAssessments = shallowRef<GrowthAssessmentHistoryItem[]>([])
const backendSessions = shallowRef<GrowthTrainingHistoryItem[]>([])

const localSessions = computed<GrowthTrainingHistoryItem[]>(() =>
  [...store.getSnapshot().sessions]
    .filter(session => session.completed)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map(session => ({
      id: session.id,
      modality: session.modality,
      date: session.date,
      summary: session.analysis.summary,
      qualityScore: session.analysis.qualityScore
    }))
)

const localAssessments = computed<GrowthAssessmentHistoryItem[]>(() =>
  Object.values(store.getSnapshot().longQuestionnaires)
    .filter(questionnaire => questionnaire.completed)
    .map(questionnaire => ({
      checkpoint: questionnaire.checkpoint,
      title: `${CHECKPOINT_LABELS[questionnaire.checkpoint]} 长问卷`,
      score: questionnaire.score ?? 0,
      percentage: questionnaire.percentage ?? 0,
      submittedAt: questionnaire.submittedAt
    }))
)

const assessments = computed(() =>
  backendAssessments.value.length > 0 ? backendAssessments.value : localAssessments.value
)

const sessions = computed(() =>
  backendSessions.value.length > 0 ? backendSessions.value : localSessions.value
)

onMounted(async () => {
  try {
    const history = await studentBackendSync.loadGrowthHistory()
    backendAssessments.value = history.assessments
    backendSessions.value = history.trainingSessions
  } catch (error) {
    console.warn('[student-backend] 历史记录读取失败', error)
  }
})
</script>

<template>
  <UniGrowthPageShell dock-tab="growth">
    <h1 class="detail-page__title">训练与评估历史</h1>
    <p class="detail-page__subtitle">训练亮点与长问卷评估点。</p>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">训练记录</h2>
      <TrainingHistoryList :sessions="sessions" />
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">长问卷</h2>
      <AssessmentHistoryList :assessments="assessments" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0; color: #576988; font-size: 0.88rem; }
.detail-page__card { border: 1px solid #dbe5f7; border-radius: 12px; padding: 0.9rem; background: #fff; }
.detail-page__heading { margin: 0 0 0.65rem; color: #223f70; font-size: 0.95rem; }
</style>
