<script setup lang="ts">
import { computed } from 'vue'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import { buildGrowthSummary } from '../../../domain/student/growth'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const summary = computed(() => buildGrowthSummary(store.getSnapshot()))
</script>

<template>
  <UniGrowthPageShell>
    <h1 class="detail-page__title">Adherence Detail</h1>
    <p class="detail-page__subtitle">Day-level heatmap for recent training behavior.</p>

    <section class="detail-page__card">
      <AdherenceHeatmap :days="summary.adherenceCalendar" />
      <p class="detail-page__note">Each square represents one day. Darker means daily goal reached.</p>
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0; color: #576988; font-size: 0.88rem; }
.detail-page__card { border: 1px solid #dbe5f7; border-radius: 12px; padding: 0.9rem; background: #fff; }
.detail-page__note { margin: 0.65rem 0 0; color: #5a6b89; font-size: 0.8rem; }
</style>
