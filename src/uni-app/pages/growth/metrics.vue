<script setup lang="ts">
import { computed, onMounted } from 'vue'
import PhysicalMetricsPanel from '../../../components/growth/PhysicalMetricsPanel.vue'
import { resolvePhysicalMetricsState } from '../../../domain/student/growth'
import { studentBackendSync } from '../../api/studentBackend'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
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
    <UniPageHeading
      eyebrow="成长"
      title="体能指标"
      description="导入的体测数据与趋势快照。"
    />

    <section class="detail-page__card">
      <p v-if="!metricsState.hasMetrics" class="detail-page__hint">{{ emptyStateHint }}</p>
      <PhysicalMetricsPanel :metrics-state="metricsState" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__card { border: 2rpx solid rgba(255, 211, 132, 0.3); border-radius: 28rpx; padding: 32rpx; background: rgba(255, 255, 255, 0.94); }
.detail-page__hint { margin: 0 0 20rpx; color: #718096; font-size: 22rpx; }
</style>
