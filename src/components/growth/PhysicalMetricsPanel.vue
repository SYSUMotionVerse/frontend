<script setup lang="ts">
import { computed } from 'vue'
import type { PhysicalMetricsState } from '../../features/growth/summary'
import type { PhysicalMetricTrend } from '../../domain/student/types'

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

function metricValue(metric: PhysicalMetricTrend, position: 'before' | 'after') {
  if (position === 'before') {
    return metric.before ?? metric.values[0] ?? null
  }
  return metric.after ?? metric.values[1] ?? null
}

function formatValue(value: number | null) {
  return value === null ? '—' : String(value)
}

function formatChange(metric: PhysicalMetricTrend) {
  const before = metricValue(metric, 'before')
  const after = metricValue(metric, 'after')
  const change = metric.change ?? (
    before !== null && after !== null
      ? Math.round((after - before) * 100) / 100
      : null
  )
  if (change === null) return '—'

  const sign = change > 0 ? '+' : ''
  const changePercent = metric.changePercent ?? (
    before !== null && before !== 0
      ? Math.round((change / before) * 10000) / 100
      : null
  )
  return changePercent === null
    ? `${sign}${change}`
    : `${sign}${change}（${sign}${changePercent}%）`
}
</script>

<template>
  <view class="metrics" aria-label="身体指标面板">
    <text v-if="!hasMetrics" class="metrics__empty">{{ emptyMessage }}</text>

    <view v-for="metric in metrics" :key="metric.label" class="metric-card">
      <view class="metric-card__header">
        <text class="metric-card__label">{{ metric.label }}</text>
        <text class="metric-card__unit">{{ metric.unit }}</text>
      </view>

      <view class="metric-card__comparison" aria-label="实验前后成绩对比">
        <view class="metric-card__column">
          <text class="metric-card__caption">实验前</text>
          <text class="metric-card__value">{{ formatValue(metricValue(metric, 'before')) }}</text>
        </view>
        <view class="metric-card__column">
          <text class="metric-card__caption">实验后</text>
          <text class="metric-card__value">{{ formatValue(metricValue(metric, 'after')) }}</text>
        </view>
        <view class="metric-card__column metric-card__column--change">
          <text class="metric-card__caption">变化</text>
          <text class="metric-card__value">{{ formatChange(metric) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.metrics {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.metrics__empty {
  display: block;
  margin: 0;
  padding: 40rpx;
  border-radius: 48rpx;
  background: rgba(255, 211, 132, 0.06);
  color: #64748B;
  border: 8rpx dashed rgba(255, 211, 132, 0.3);
  font-weight: 600;
  font-size: 28rpx;
}

.metric-card {
  border: 8rpx solid rgba(255, 211, 132, 0.2);
  border-radius: 48rpx;
  padding: 40rpx;
  background: #fff;
  box-shadow: 0 12rpx 0px rgba(0, 0, 0, 0.04);
}

.metric-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16rpx;
}

.metric-card__label {
  margin: 0;
  color: #1A202C;
  font-size: 32rpx;
  font-weight: 900;
}

.metric-card__unit {
  color: #64748B;
  font-size: 24rpx;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-card__comparison {
  display: flex;
  gap: 12rpx;
  margin: 24rpx 0 0;
  padding: 0;
}

.metric-card__column {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
  border-radius: 20rpx;
  background: rgba(137, 207, 255, 0.15);
  padding: 16rpx 12rpx;
  text-align: center;
}

.metric-card__column--change {
  background: rgba(255, 211, 132, 0.2);
}

.metric-card__caption {
  color: #64748B;
  font-size: 22rpx;
  font-weight: 700;
}

.metric-card__value {
  color: #1A202C;
  font-size: 26rpx;
  font-weight: 800;
}
</style>
