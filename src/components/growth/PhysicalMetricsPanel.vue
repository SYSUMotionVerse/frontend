<script setup lang="ts">
import { computed } from 'vue'
import type { PhysicalMetricsState } from '../../features/growth/summary'

const props = defineProps<{
  metricsState: PhysicalMetricsState
}>()

function hasPhysicalMetrics(
  metricsState: PhysicalMetricsState
): metricsState is Extract<PhysicalMetricsState, { hasMetrics: true }> {
  return metricsState.hasMetrics
}

const hasMetrics = computed(() => props.metricsState.hasMetrics)
const emptyMessage = computed(() => hasPhysicalMetrics(props.metricsState) ? '' : props.metricsState.message)
const metrics = computed(() => hasPhysicalMetrics(props.metricsState) ? props.metricsState.metrics : [])
</script>

<template>
  <section class="metrics" aria-label="Physical metrics panel">
    <p v-if="!hasMetrics" class="metrics__empty">{{ emptyMessage }}</p>

    <article v-for="metric in metrics" :key="metric.label" class="metric-card">
      <header class="metric-card__header">
        <h4 class="metric-card__label">{{ metric.label }}</h4>
        <span class="metric-card__unit">{{ metric.unit }}</span>
      </header>

      <ul class="metric-card__trend" aria-label="Metric trend values">
        <li v-for="(value, index) in metric.values" :key="index" class="metric-card__point">
          {{ value }}
        </li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.metrics {
  display: grid;
  gap: 0.6rem;
}

.metrics__empty {
  margin: 0;
  padding: 0.8rem;
  border-radius: 10px;
  background: #f8fafc;
  color: #4f5f78;
  border: 1px dashed #bdd0ec;
}

.metric-card {
  border: 1px solid #d9e4f8;
  border-radius: 10px;
  padding: 0.75rem;
  background: #fff;
}

.metric-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.metric-card__label {
  margin: 0;
  color: #243e74;
  font-size: 0.95rem;
}

.metric-card__unit {
  color: #596b88;
  font-size: 0.8rem;
}

.metric-card__trend {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.metric-card__point {
  border-radius: 999px;
  background: #eef4ff;
  color: #1c3270;
  padding: 0.2rem 0.45rem;
  font-size: 0.78rem;
}
</style>
