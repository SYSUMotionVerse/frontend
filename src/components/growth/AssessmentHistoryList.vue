<script setup lang="ts">
import { computed } from 'vue'
import type { CheckpointKey, LongQuestionnaireState } from '../../types/student'

const props = defineProps<{
  questionnaires: Record<CheckpointKey, LongQuestionnaireState>
}>()

const orderedHistory = computed(() => {
  const order: CheckpointKey[] = ['baseline', 'week4', 'week8', 'week12']
  return order.map(checkpoint => props.questionnaires[checkpoint])
})
</script>

<template>
  <section class="assessment" aria-label="Assessment history">
    <ul class="assessment__list">
      <li v-for="checkpoint in orderedHistory" :key="checkpoint.checkpoint" class="assessment-item">
        <p class="assessment-item__name">{{ checkpoint.checkpoint.toUpperCase() }}</p>
        <p class="assessment-item__result">
          {{ checkpoint.completed ? `Score ${checkpoint.score} · ${checkpoint.percentage}%` : 'Not completed yet' }}
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.assessment__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.assessment-item {
  border-radius: 10px;
  border: 1px solid #dbe6f8;
  padding: 0.65rem 0.7rem;
  background: #fff;
}

.assessment-item__name {
  margin: 0;
  font-weight: 600;
  color: #264377;
}

.assessment-item__result {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: #556887;
}
</style>
