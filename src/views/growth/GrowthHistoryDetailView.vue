<script setup lang="ts">
import { computed } from 'vue'
import AssessmentHistoryList from '../../components/growth/AssessmentHistoryList.vue'
import TrainingHistoryList from '../../components/growth/TrainingHistoryList.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'

const { state } = useStudentAppState()

const completedSessions = computed(() =>
  [...state.sessions]
    .filter(session => session.completed)
    .sort((left, right) => right.date.localeCompare(left.date))
)
</script>

<template>
  <main class="detail-page">
    <h1 class="detail-page__title">Training & Assessment History</h1>
    <p class="detail-page__subtitle">Session highlights and long-questionnaire checkpoints.</p>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">Training Sessions</h2>
      <TrainingHistoryList :sessions="completedSessions" />
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">Long Questionnaires</h2>
      <AssessmentHistoryList :questionnaires="state.longQuestionnaires" />
    </section>
  </main>
</template>

<style scoped>
.detail-page {
  margin: 0 auto;
  width: min(760px, 100%);
  padding: 1.25rem;
  display: grid;
  gap: 0.7rem;
}

.detail-page__title {
  margin: 0;
  color: #1d366b;
}

.detail-page__subtitle {
  margin: 0;
  color: #576988;
  font-size: 0.88rem;
}

.detail-page__card {
  border: 1px solid #dbe5f7;
  border-radius: 12px;
  padding: 0.9rem;
  background: #fff;
}

.detail-page__heading {
  margin: 0 0 0.65rem;
  color: #223f70;
  font-size: 0.95rem;
}
</style>
