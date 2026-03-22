<script setup lang="ts">
import { computed } from 'vue'
import PhysicalMetricsPanel from '../../components/growth/PhysicalMetricsPanel.vue'
import { resolvePhysicalMetricsState } from '../../features/growth/summary'
import { useStudentAppState } from '../../composables/useStudentAppState'

const { state } = useStudentAppState()

const metricsState = computed(() => resolvePhysicalMetricsState(state))
</script>

<template>
  <main class="detail-page">
    <h1 class="detail-page__title">Physical Metrics Detail</h1>
    <p class="detail-page__subtitle">Imported body-test metrics and trend snapshots.</p>

    <section class="detail-page__card">
      <PhysicalMetricsPanel :metrics-state="metricsState" />
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
</style>
