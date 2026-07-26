<script setup lang="ts">
import type { GrowthTrainingHistoryItem } from '../../uni-app/api/studentBackendTypes'

defineProps<{
  sessions: GrowthTrainingHistoryItem[]
}>()
</script>

<template>
  <view class="history" aria-label="训练历史">
    <text v-if="sessions.length === 0" class="history__empty block">暂无已完成训练。</text>

    <view v-else class="history__list">
      <view v-for="session in sessions" :key="session.id" class="history-item">
        <text class="history-item__headline block">
          {{ session.modality.toUpperCase() }} · {{ session.date }}
        </text>
        <text class="history-item__subline block">{{ session.summary }}</text>
        <text class="history-item__meta block">
          {{ session.qualityScore === null ? '质量分：暂无评分' : `质量分：${session.qualityScore}` }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.history__empty {
  margin: 0;
  padding: 40rpx;
  border-radius: 48rpx;
  border: 8rpx dashed rgba(255, 211, 132, 0.3);
  color: #64748B;
  font-weight: 600;
  background: rgba(255, 211, 132, 0.06);
  font-size: 28rpx;
}

.history__list {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  margin: 0;
  padding: 0;
}

.history-item {
  border-radius: 48rpx;
  border: 8rpx solid rgba(137, 207, 255, 0.2);
  background: #fff;
  padding: 40rpx;
  box-shadow: 0 12rpx 0px rgba(0, 0, 0, 0.04);
}

.history-item__headline {
  margin: 0;
  color: #1A202C;
  font-weight: 900;
  font-size: 32rpx;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-item__subline {
  margin: 16rpx 0 0;
  color: #64748B;
  font-size: 28rpx;
  font-weight: 600;
}

.history-item__meta {
  margin: 16rpx 0 0;
  color: #FF8B8B;
  font-size: 26rpx;
  font-weight: 900;
}
</style>
