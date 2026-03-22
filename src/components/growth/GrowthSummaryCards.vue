<script setup lang="ts">
import type { GrowthAssessmentSummary, GrowthSummaryCard } from '../../features/growth/summary'

defineProps<{
  cards: GrowthSummaryCard[]
  latestAssessment: GrowthAssessmentSummary | null
}>()
</script>

<template>
  <section class="summary-cards" aria-label="Growth summary cards">
    <article v-for="card in cards" :key="card.key" class="summary-card">
      <p class="summary-card__label">{{ card.label }}</p>
      <p class="summary-card__value">{{ card.value }}</p>
      <p class="summary-card__description">{{ card.description }}</p>
    </article>

    <article class="summary-card summary-card--assessment">
      <p class="summary-card__label">Latest Assessment</p>
      <p class="summary-card__value">
        {{ latestAssessment ? latestAssessment.checkpoint.toUpperCase() : 'No data yet' }}
      </p>
      <p class="summary-card__description">
        {{
          latestAssessment
            ? `Score ${latestAssessment.score} (${latestAssessment.percentage}%)`
            : 'Complete a long questionnaire to unlock this trend.'
        }}
      </p>
    </article>
  </section>
</template>

<style scoped>
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.summary-card {
  border: 1px solid #d8e2ff;
  border-radius: 12px;
  padding: 0.75rem;
  background: #fff;
}

.summary-card--assessment {
  border-color: #7da2ff;
  background: #f3f7ff;
}

.summary-card__label {
  margin: 0;
  color: #4b5e8a;
  font-size: 0.85rem;
}

.summary-card__value {
  margin: 0.35rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1c2b59;
}

.summary-card__description {
  margin: 0;
  color: #5a6780;
  font-size: 0.78rem;
}
</style>
