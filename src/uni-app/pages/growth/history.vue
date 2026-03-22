<script setup lang="ts">
import { computed } from 'vue'
import AssessmentHistoryList from '../../../components/growth/AssessmentHistoryList.vue'
import TrainingHistoryList from '../../../components/growth/TrainingHistoryList.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()

const completedSessions = computed(() =>
  [...store.getSnapshot().sessions]
    .filter(session => session.completed)
    .sort((left, right) => right.date.localeCompare(left.date))
)

const questionnaires = computed(() => store.getSnapshot().longQuestionnaires)
</script>

<template>
  <UniGrowthPageShell>
    <h1 class="detail-page__title">Training & Assessment History</h1>
    <p class="detail-page__subtitle">Session highlights and long-questionnaire checkpoints.</p>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">Training Sessions</h2>
      <TrainingHistoryList :sessions="completedSessions" />
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">Long Questionnaires</h2>
      <AssessmentHistoryList :questionnaires="questionnaires" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0; color: #576988; font-size: 0.88rem; }
.detail-page__card { border: 1px solid #dbe5f7; border-radius: 12px; padding: 0.9rem; background: #fff; }
.detail-page__heading { margin: 0 0 0.65rem; color: #223f70; font-size: 0.95rem; }
</style>
