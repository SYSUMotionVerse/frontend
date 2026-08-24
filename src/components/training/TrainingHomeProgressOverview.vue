<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completedCount: number
  goalCompleted: boolean
  totalCount: number
  weekQualifyingDayCount: number
}>()

const segments = computed(() => Array.from(
  { length: props.totalCount },
  (_, index) => index + 1
))
</script>

<template>
  <view class="home-progress" aria-label="训练概览">
    <view class="home-progress__head">
      <view class="home-progress__copy">
        <text class="home-progress__title">训练进度</text>
        <text class="home-progress__subtitle">完成情况会在训练结束后更新。</text>
      </view>
      <text
        class="home-progress__status"
        :class="{ 'home-progress__status--done': props.goalCompleted }"
      >
        {{ props.goalCompleted ? '今日达标' : '进行中' }}
      </text>
    </view>

    <view class="home-progress__today">
      <view class="home-progress__today-copy">
        <text class="home-progress__label">今日完成</text>
        <text class="home-progress__value">{{ props.completedCount }} / {{ props.totalCount }}</text>
      </view>
      <view class="home-progress__track" aria-hidden="true">
        <view
          v-for="segment in segments"
          :key="segment"
          class="home-progress__segment"
          :class="{ 'home-progress__segment--done': segment <= props.completedCount }"
        />
      </view>
    </view>

    <view class="home-progress__week">
      <text class="home-progress__label">本周已达标</text>
      <text class="home-progress__week-value">{{ props.weekQualifyingDayCount }} 天</text>
    </view>
  </view>
</template>

<style scoped>
.home-progress {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 32rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 44rpx;
  background: #fffaf4;
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.home-progress__head,
.home-progress__today,
.home-progress__week {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.home-progress__copy,
.home-progress__today-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}

.home-progress__title {
  display: block;
  color: #203042;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.2;
}

.home-progress__subtitle {
  display: block;
  color: #718096;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.42;
}

.home-progress__status {
  display: inline-flex;
  min-height: 48rpx;
  flex: none;
  align-items: center;
  padding: 0 14rpx;
  border-radius: 9999px;
  background: #ffe8e5;
  color: #c76b5b;
  font-size: 20rpx;
  font-weight: 800;
}

.home-progress__status--done {
  background: #e0f1f8;
  color: #2b7cb8;
}

.home-progress__today {
  padding: 22rpx 0;
  border-top: 2rpx solid rgba(224, 111, 120, 0.1);
  border-bottom: 2rpx solid rgba(224, 111, 120, 0.1);
}

.home-progress__label {
  display: block;
  color: #718096;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.2;
}

.home-progress__value,
.home-progress__week-value {
  display: block;
  color: #203042;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.24;
}

.home-progress__track {
  display: flex;
  width: 196rpx;
  gap: 8rpx;
}

.home-progress__segment {
  height: 14rpx;
  flex: 1;
  border-radius: 9999px;
  background: rgba(199, 107, 91, 0.16);
}

.home-progress__segment--done {
  background: #c76b5b;
}
</style>
