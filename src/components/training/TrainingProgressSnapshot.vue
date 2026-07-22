<script setup lang="ts">
import type { TrainingProgressModalityView } from '../../features/training/progress'

const props = defineProps<{
  completedCount: number
  modalities: readonly TrainingProgressModalityView[]
  totalCount: number
  weekQualifyingDayCount: number
}>()
</script>

<template>
  <view class="progress-snapshot" aria-label="今日训练进度">
    <view class="progress-snapshot__head">
      <view class="progress-snapshot__copy">
        <text class="progress-snapshot__title">今天的进度</text>
        <text class="progress-snapshot__subtitle">完成一项，今天就更扎实一点。</text>
      </view>
      <view class="progress-snapshot__count">
        <text>{{ props.completedCount }} / {{ props.totalCount }}</text>
      </view>
    </view>

    <view class="progress-snapshot__track">
      <view
        v-for="modality in props.modalities"
        :key="modality.id"
        class="progress-snapshot__step"
        :class="{ 'progress-snapshot__step--done': modality.completed }"
      >
        <view class="progress-snapshot__dot">
          <text>{{ modality.completed ? '✓' : '' }}</text>
        </view>
        <text class="progress-snapshot__label">{{ modality.label }}</text>
      </view>
    </view>

    <text class="progress-snapshot__week">本周已达标 {{ props.weekQualifyingDayCount }} 天</text>
  </view>
</template>

<style scoped>
.progress-snapshot {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 28rpx;
  border-radius: 36rpx;
  background: #f1faf5;
}

.progress-snapshot__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.progress-snapshot__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.progress-snapshot__title {
  display: block;
  color: #203042;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.24;
}

.progress-snapshot__subtitle,
.progress-snapshot__week {
  display: block;
  color: #718096;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.45;
}

.progress-snapshot__count {
  display: inline-flex;
  min-width: 80rpx;
  min-height: 48rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0 14rpx;
  border-radius: 9999px;
  background: rgba(168, 230, 207, 0.6);
  color: #3f8b68;
  font-size: 22rpx;
  font-weight: 900;
}

.progress-snapshot__track {
  display: flex;
  gap: 12rpx;
}

.progress-snapshot__step {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8rpx;
  color: #90a0ae;
}

.progress-snapshot__dot {
  display: inline-flex;
  width: 28rpx;
  height: 28rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgba(123, 135, 152, 0.24);
  border-radius: 9999px;
  background: #fbfdfb;
  color: #fbfdfb;
  font-size: 16rpx;
  font-weight: 900;
}

.progress-snapshot__step--done {
  color: #3f8b68;
}

.progress-snapshot__step--done .progress-snapshot__dot {
  border-color: rgba(63, 139, 104, 0.28);
  background: #78c69c;
}

.progress-snapshot__label {
  display: block;
  overflow: hidden;
  font-size: 18rpx;
  font-weight: 800;
  line-height: 1.24;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
