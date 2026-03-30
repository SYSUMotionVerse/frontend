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
  <UniGrowthPageShell dock-tab="growth">
    <h1 class="detail-page__title">达标详情</h1>
    <p class="detail-page__subtitle">近期训练行为的日级热力图。</p>

    <section class="detail-page__card">
      <AdherenceHeatmap :days="summary.adherenceCalendar" />
      <p class="detail-page__note">每个方块代表一天，颜色越深表示达标。</p>
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0; color: #576988; font-size: 0.88rem; }
.detail-page__card { border: 1px solid #dbe5f7; border-radius: 12px; padding: 0.9rem; background: #fff; }
.detail-page__note { margin: 0.65rem 0 0; color: #5a6b89; font-size: 0.8rem; }
</style>
