<script setup lang="ts">
import { computed } from 'vue'
import GrowthLoadStatus from '../../../components/growth/GrowthLoadStatus.vue'
import PhysicalMetricsPanel from '../../../components/growth/PhysicalMetricsPanel.vue'
import VisualScoreTrendPanel from '../../../components/growth/VisualScoreTrendPanel.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'

const { loadState, physicalMetricsState, refresh, scoreTrend } = useGrowthOverview({
  sections: ['physicalMetrics', 'visualScoreTrend']
})
const emptyStateHint = computed(() =>
  physicalMetricsState.value.hasMetrics ? '' : physicalMetricsState.value.message
)
</script>

<template>
  <UniGrowthPageShell :show-dock="false" page-title="体能指标" show-back>
    <UniPageHeading
      eyebrow="成长"
      title="体能指标"
      description="集中查看体测数据与动作表现。"
    />

    <GrowthLoadStatus
      :status="loadState.status"
      :message="loadState.message"
      @retry="refresh({ force: true })"
    />

    <section class="detail-page__card">
      <h2 class="detail-page__heading">体测趋势</h2>
      <p v-if="!physicalMetricsState.hasMetrics" class="detail-page__hint">{{ emptyStateHint }}</p>
      <PhysicalMetricsPanel :metrics-state="physicalMetricsState" />
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">动作得分趋势</h2>
      <VisualScoreTrendPanel :score-trend="scoreTrend" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__card { margin-bottom: 28rpx; border: 2rpx solid rgba(255, 211, 132, 0.3); border-radius: 28rpx; padding: 32rpx; background: rgba(255, 255, 255, 0.94); }
.detail-page__heading { margin: 0 0 20rpx; color: #203042; font-size: 30rpx; }
.detail-page__hint { margin: 0 0 20rpx; color: #718096; font-size: 22rpx; }
</style>
