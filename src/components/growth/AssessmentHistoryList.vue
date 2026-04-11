<script setup lang="ts">
import type { GrowthAssessmentHistoryItem } from '../../uni-app/api/studentBackendTypes'

defineProps<{
  assessments: GrowthAssessmentHistoryItem[]
}>()
</script>

<template>
  <view class="assessment" aria-label="评估历史">
    <text v-if="assessments.length === 0" class="assessment__empty block">暂无已完成评估。</text>

    <view v-else class="assessment__list">
      <view v-for="assessment in assessments" :key="`${assessment.checkpoint}-${assessment.submittedAt}`" class="assessment-item">
        <text class="assessment-item__name block">{{ assessment.title }}</text>
        <text class="assessment-item__meta block">{{ assessment.checkpoint.toUpperCase() }}</text>
        <text class="assessment-item__result block">
          {{ `得分 ${assessment.score} · ${assessment.percentage}%` }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.assessment__empty {
  margin: 0;
  padding: 40rpx;
  border-radius: 48rpx;
  border: 8rpx dashed rgba(255, 211, 132, 0.3);
  color: #64748B;
  font-weight: 600;
  background: rgba(255, 211, 132, 0.06);
  font-size: 28rpx;
}

.assessment__list {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.assessment-item {
  border-radius: 48rpx;
  border: 8rpx solid rgba(255, 211, 132, 0.2);
  padding: 32rpx 40rpx;
  background: #fff;
  box-shadow: 0 12rpx 0px rgba(0, 0, 0, 0.04);
}

.assessment-item__name {
  margin: 0;
  font-weight: 900;
  color: #1A202C;
  font-size: 32rpx;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.assessment-item__result {
  margin: 16rpx 0 0;
  font-size: 28rpx;
  color: #64748B;
  font-weight: 700;
}

.assessment-item__meta {
  margin: 16rpx 0 0;
  font-size: 24rpx;
  color: #D97706;
  font-weight: 900;
  letter-spacing: 0.08em;
}
</style>
