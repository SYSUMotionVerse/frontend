<script setup lang="ts">
import type { GrowthTrainingHistoryItem } from '../../uni-app/api/studentBackendTypes'

const props = defineProps<{
  sessions: GrowthTrainingHistoryItem[]
}>()

const modalityLabels: Record<GrowthTrainingHistoryItem['modality'], string> = {
  wushu: '武术',
  hiit: '自重抗阻',
  stair: '跑楼梯'
}

function formatDuration(durationSeconds?: number | null) {
  if (!durationSeconds) return '时长暂无'
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = Math.round(durationSeconds % 60)
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
}

</script>

<template>
  <view class="history" aria-label="训练历史">
    <text v-if="sessions.length === 0" class="history__empty block">暂无已完成训练。</text>

    <view v-else class="history__list">
      <view v-for="session in sessions" :key="session.id" class="history-item">
        <view class="history-item__head">
          <view class="history-item__identity">
            <text class="history-item__headline">{{ modalityLabels[session.modality] }}</text>
            <text class="history-item__date">{{ session.date }}</text>
          </view>
          <view class="history-item__score">
            <text class="history-item__score-value">{{ session.qualityScore === null ? '—' : session.qualityScore }}</text>
            <text class="history-item__score-label">质量分</text>
          </view>
        </view>
        <text class="history-item__subline block">{{ session.summary }}</text>
        <view class="history-item__meta">
          <text>训练时长</text>
          <text>{{ formatDuration(session.durationSeconds) }}</text>
        </view>
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
  gap: 18rpx;
  margin: 0;
  padding: 0;
}

.history-item {
  border-radius: 26rpx;
  border: 2rpx solid rgba(137, 207, 255, 0.28);
  background: #fffdf9;
  padding: 24rpx;
  box-shadow: 0 8rpx 18rpx rgba(71, 56, 39, 0.04);
}

.history-item__head,
.history-item__identity,
.history-item__score,
.history-item__meta {
  display: flex;
}

.history-item__head {
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.history-item__identity,
.history-item__score {
  flex-direction: column;
}

.history-item__identity { gap: 6rpx; }

.history-item__score {
  min-width: 74rpx;
  align-items: flex-end;
  gap: 2rpx;
}

.history-item__headline {
  margin: 0;
  color: #1A202C;
  font-weight: 900;
  font-size: 30rpx;
  line-height: 1.25;
}

.history-item__date,
.history-item__score-label {
  color: #8a97a8;
  font-size: 20rpx;
  font-weight: 700;
}

.history-item__score-value {
  color: #ff7d7d;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1;
}

.history-item__subline {
  margin: 18rpx 0 0;
  color: #64748B;
  font-size: 23rpx;
  font-weight: 600;
}

.history-item__meta {
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid rgba(226, 232, 240, 0.86);
  color: #718096;
  font-size: 21rpx;
  font-weight: 700;
}

</style>
