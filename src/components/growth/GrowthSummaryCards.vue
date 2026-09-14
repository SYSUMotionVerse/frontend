<script setup lang="ts">
import type { GrowthAssessmentSummary, GrowthSummaryCard } from '../../features/growth/summary'

defineProps<{
  cards: GrowthSummaryCard[]
  latestAssessment: GrowthAssessmentSummary | null
}>()
</script>

<template>
  <view class="summary-cards" aria-label="成长总结卡片">
    <view v-for="card in cards" :key="card.key" class="summary-card">
      <view class="summary-card__pill">
        <text class="summary-card__label">{{ card.label }}</text>
      </view>
      <text class="summary-card__value">{{ card.value }}</text>
      <text class="summary-card__description">{{ card.description }}</text>
    </view>

    <view class="summary-card summary-card--assessment summary-card--highlight">
      <view class="summary-card__pill">
        <text class="summary-card__label">最近评估</text>
      </view>
      <text class="summary-card__value">
        {{ latestAssessment ? latestAssessment.checkpoint.toUpperCase() : '暂无数据' }}
      </text>
      <text class="summary-card__description">
        {{
          latestAssessment
            ? latestAssessment.score !== null && latestAssessment.percentage !== null
              ? `得分 ${latestAssessment.score}（${latestAssessment.percentage}%）`
              : '已完成，评分待研究规则。'
            : '完成长问卷后可解锁趋势。'
        }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.summary-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 32rpx;
}

.summary-card {
  flex: 1 1 360rpx;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border: 8rpx solid rgba(255, 211, 132, 0.28);
  border-radius: 48rpx;
  padding: 40rpx;
  background: #fff;
  box-shadow: 0 12rpx 0px rgba(0, 0, 0, 0.05);
}

.summary-card--assessment {
  border-color: rgba(137, 207, 255, 0.3);
  background: rgba(137, 207, 255, 0.06);
}

.summary-card__pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 12rpx 20rpx;
  border-radius: 9999px;
  background: rgba(255, 211, 132, 0.16);
  border: 4rpx solid rgba(255, 211, 132, 0.24);
}

.summary-card--highlight .summary-card__pill {
  background: rgba(137, 207, 255, 0.14);
  border-color: rgba(137, 207, 255, 0.24);
}

.summary-card__label {
  display: block;
  margin: 0;
  color: #475569;
  font-size: 24rpx;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.summary-card__value {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  color: #1A202C;
}

.summary-card__description {
  display: block;
  margin: 0;
  color: #64748B;
  font-size: 26rpx;
  font-weight: 600;
}
</style>
