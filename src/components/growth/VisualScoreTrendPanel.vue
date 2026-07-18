<script setup lang="ts">
import type { GrowthVisualScoreTrendModel } from '../../uni-app/api/studentBackendTypes'

defineProps<{
  scoreTrend: GrowthVisualScoreTrendModel | null
}>()
</script>

<template>
  <view class="score-trend" aria-label="视觉训练得分趋势">
    <text v-if="!scoreTrend || scoreTrend.trend.length === 0" class="score-trend__empty">
      暂无视觉训练得分趋势。
    </text>

    <template v-else>
      <view class="score-trend__summary">
        <view class="score-trend__summary-item">
          <text class="score-trend__summary-label">训练次数</text>
          <text class="score-trend__summary-value">{{ scoreTrend.summary.sessionCount }}</text>
        </view>
        <view class="score-trend__summary-item">
          <text class="score-trend__summary-label">最近得分</text>
          <text class="score-trend__summary-value">{{ scoreTrend.summary.latestOverallScore }}</text>
        </view>
        <view class="score-trend__summary-item">
          <text class="score-trend__summary-label">最佳得分</text>
          <text class="score-trend__summary-value">{{ scoreTrend.summary.bestOverallScore }}</text>
        </view>
      </view>

      <view class="score-trend__points">
        <view v-for="point in scoreTrend.trend" :key="point.recordId" class="score-trend__point">
          <text class="score-trend__date">{{ point.date }}</text>
          <text class="score-trend__score">{{ point.overallScore }}</text>
        </view>
      </view>

      <view v-if="scoreTrend.dimensions.length > 0" class="score-trend__dimensions">
        <view
          v-for="dimension in scoreTrend.dimensions"
          :key="dimension.key"
          class="score-trend__dimension"
        >
          <text class="score-trend__dimension-label">{{ dimension.label }}</text>
          <text class="score-trend__dimension-values">{{ dimension.values.join(' → ') }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.score-trend,
.score-trend__summary-item,
.score-trend__point,
.score-trend__dimension {
  display: flex;
  flex-direction: column;
}

.score-trend {
  gap: 24rpx;
}

.score-trend__empty {
  display: block;
  padding: 32rpx;
  border: 4rpx dashed rgba(137, 207, 255, 0.3);
  border-radius: 32rpx;
  color: #64748B;
  font-size: 26rpx;
  font-weight: 700;
}

.score-trend__summary,
.score-trend__points,
.score-trend__dimensions {
  display: flex;
  gap: 20rpx;
}

.score-trend__summary,
.score-trend__points {
  flex-wrap: wrap;
}

.score-trend__summary-item,
.score-trend__point {
  flex: 1 1 180rpx;
  gap: 8rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(137, 207, 255, 0.12);
}

.score-trend__summary-label,
.score-trend__date,
.score-trend__dimension-label {
  color: #64748B;
  font-size: 22rpx;
  font-weight: 800;
}

.score-trend__summary-value,
.score-trend__score {
  color: #1A202C;
  font-size: 36rpx;
  font-weight: 900;
}

.score-trend__dimensions {
  flex-direction: column;
}

.score-trend__dimension {
  gap: 8rpx;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(168, 230, 207, 0.14);
}

.score-trend__dimension-values {
  color: #1A202C;
  font-size: 26rpx;
  font-weight: 800;
}
</style>
