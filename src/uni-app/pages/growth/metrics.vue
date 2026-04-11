<script setup lang="ts">
import { computed, onMounted } from 'vue'
import PhysicalMetricsPanel from '../../../components/growth/PhysicalMetricsPanel.vue'
import { resolvePhysicalMetricsState } from '../../../domain/student/growth'
import { studentBackendSync } from '../../api/studentBackend'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const metricsState = computed(() => resolvePhysicalMetricsState(store.getSnapshot()))
const emptyStateHint = computed(() => metricsState.value.hasMetrics ? '' : metricsState.value.message)

onMounted(async () => {
  try {
    const metrics = await studentBackendSync.loadPhysicalMetrics()
    if (metrics.length > 0) {
      store.setPhysicalMetrics(metrics)
    }
  } catch (error) {
    console.warn('[student-backend] 体测趋势读取失败', error)
  }
})
</script>

<template>
  <UniGrowthPageShell dock-tab="growth">
    <h1 class="detail-page__title">体能指标详情</h1>
    <p class="detail-page__subtitle">导入的体测数据与趋势快照。</p>

    <section class="detail-page__card">
      <p v-if="!metricsState.hasMetrics" class="detail-page__hint">{{ emptyStateHint }}</p>
      <PhysicalMetricsPanel :metrics-state="metricsState" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0; color: #576988; font-size: 0.88rem; }
.detail-page__card { border: 1px solid #dbe5f7; border-radius: 12px; padding: 0.9rem; background: #fff; }
.detail-page__hint { margin: 0 0 0.65rem; color: #5a6b89; font-size: 0.8rem; }
</style>
