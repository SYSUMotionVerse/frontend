<script setup lang="ts">
import type { TrainingProgressModalityView } from '../../features/training/progress'

const props = defineProps<{
  dailyCount: number
  modalities: readonly TrainingProgressModalityView[]
  weekQualifyingDayCount: number
}>()

const progressSegments = [1, 2, 3]
</script>

<template>
  <view class="card-shell progress-card">
    <view class="progress-card__header">
      <view class="progress-card__copy">
        <view class="progress-card__eyebrow">
          <text>每日任务记录</text>
        </view>
        <text class="block section-title">今日能量循环</text>
        <text class="block mt-[20rpx] text-[34rpx] leading-8 text-slate-600 font-700">
          三种训练各完成一次，重复训练会保留记录，但不会重复增加进度。
        </text>
      </view>

      <view class="progress-card__meter-pill px-[32rpx] py-[20rpx] text-[40rpx] font-900">
        {{ props.dailyCount }}/3
      </view>
    </view>

    <view class="mt-[36rpx] flex gap-[20rpx]">
      <view
        v-for="segment in progressSegments"
        :key="segment"
        class="h-[32rpx] flex-1 rounded-full"
        :class="segment <= props.dailyCount ? 'bg-brand-teal' : 'bg-slate-200'"
      />
    </view>

    <view class="progress-card__modalities">
      <view
        v-for="item in props.modalities"
        :key="item.id"
        class="progress-card__modality"
        :class="item.completed ? 'progress-card__modality--completed' : 'progress-card__modality--pending'"
      >
        <text class="progress-card__modality-label">{{ item.label }}</text>
        <text class="progress-card__modality-state">{{ item.completed ? '已完成' : '未完成' }}</text>
      </view>
    </view>

    <view class="mt-[36rpx] flex flex-wrap items-center gap-[24rpx] text-[28rpx] text-slate-600 font-700">
      <view class="chip-soft bg-brand-teal/15 text-brand-ink border-2 border-brand-teal/25">
        <text>本周达标 {{ props.weekQualifyingDayCount }} 天</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.progress-card {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.progress-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.progress-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.progress-card__eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  padding: 12rpx 20rpx;
  border: 4rpx solid rgba(255, 211, 132, 0.24);
  border-radius: 9999px;
  background: rgba(255, 211, 132, 0.14);
  color: #D97706;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.progress-card__meter-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 32rpx;
  border: 4rpx solid rgba(255, 139, 139, 0.2);
  border-radius: 9999px;
  background: rgba(255, 139, 139, 0.12);
  box-shadow: 0 6rpx 0 rgba(255, 139, 139, 0.14);
  color: #FF8B8B;
  font-size: 40rpx;
  font-weight: 900;
  white-space: nowrap;
}

.progress-card__modalities {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.progress-card__modality {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border: 2rpx solid rgba(123, 135, 152, 0.16);
  border-radius: 24rpx;
}

.progress-card__modality--completed {
  border-color: rgba(77, 185, 166, 0.28);
  background: rgba(77, 185, 166, 0.1);
}

.progress-card__modality--pending {
  background: rgba(123, 135, 152, 0.06);
}

.progress-card__modality-label {
  color: #203042;
  font-size: 28rpx;
  font-weight: 800;
}

.progress-card__modality-state {
  color: #7b8798;
  font-size: 24rpx;
  font-weight: 800;
}

.progress-card__modality--completed .progress-card__modality-state {
  color: #318675;
}
</style>
