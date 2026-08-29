<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completedCount: number
  goalCompleted: boolean
  totalCount: number
  weekQualifyingDayCount: number
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const qualifyingStartIndex = computed(() => Math.max(0, weekdays.length - props.weekQualifyingDayCount))
</script>

<template>
  <view class="home-progress" aria-label="训练概览">
    <view class="home-progress__head">
      <text class="home-progress__title">训练进度</text>
      <text class="home-progress__subtitle">完成情况会在训练结束后更新。</text>
    </view>

    <view class="home-progress__metrics">
      <view class="home-progress__metric">
        <text class="home-progress__label">今日完成</text>
        <text class="home-progress__value">{{ props.completedCount }} / {{ props.totalCount }}</text>
      </view>
      <view class="home-progress__metric home-progress__metric--week">
        <text class="home-progress__label">本周已达标</text>
        <text class="home-progress__value">{{ props.weekQualifyingDayCount }} 天</text>
      </view>
    </view>

    <view class="home-progress__week">
      <text class="home-progress__week-label">本周已达标 {{ props.weekQualifyingDayCount }} 天</text>
      <view class="home-progress__weekday-row" aria-label="本周达标记录">
        <view
          v-for="(weekday, index) in weekdays"
          :key="weekday"
          class="home-progress__weekday"
        >
          <text class="home-progress__weekday-label">{{ weekday }}</text>
          <view
            class="home-progress__weekday-dot"
            :class="{ 'home-progress__weekday-dot--done': index >= qualifyingStartIndex }"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.home-progress {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 30rpx 32rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 44rpx;
  background: #fffaf4;
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.home-progress__metrics {
  display: flex;
  align-items: stretch;
}

.home-progress__head,
.home-progress__metric,
.home-progress__week {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
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

.home-progress__metrics {
  padding: 20rpx 0;
  border-top: 2rpx solid rgba(224, 111, 120, 0.1);
  border-bottom: 2rpx solid rgba(224, 111, 120, 0.1);
}

.home-progress__metric { flex: 1; }

.home-progress__metric--week {
  padding-left: 34rpx;
  border-left: 2rpx solid rgba(32, 48, 66, 0.1);
}

.home-progress__label {
  display: block;
  color: #718096;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.2;
}

.home-progress__value {
  display: block;
  color: #203042;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.24;
}

.home-progress__week-label {
  color: #718096;
  font-size: 20rpx;
  font-weight: 700;
}

.home-progress__weekday-row {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
}

.home-progress__weekday {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12rpx;
}

.home-progress__weekday-label {
  color: #718096;
  font-size: 20rpx;
  font-weight: 700;
}

.home-progress__weekday-dot {
  width: 28rpx;
  height: 28rpx;
  border-radius: 9999px;
  background: #edf3fa;
}

.home-progress__weekday-dot--done { background: #ff8b8b; }
</style>
