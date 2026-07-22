<script setup lang="ts">
import { computed } from 'vue'
import type { VisualWorkoutState } from '../../../features/training/visualWorkoutTimeline'

const props = defineProps<{
  state: VisualWorkoutState
}>()

const remainingLabel = computed(() => {
  const minutes = Math.floor(props.state.remainingSeconds / 60)
  const seconds = props.state.remainingSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const progressStyle = computed(() => ({
  transform: `scaleX(${props.state.sessionProgressPercent / 100})`
}))
</script>

<template>
  <view class="workout-timeline">
    <view class="workout-timeline__row">
      <view class="workout-timeline__main">
        <view class="workout-timeline__step">
          <text>动作 {{ props.state.actionNumber }}/{{ props.state.totalActions }}</text>
          <text class="workout-timeline__time">{{ remainingLabel }}</text>
        </view>
        <text class="workout-timeline__title">{{ props.state.current.title }}</text>
        <text class="workout-timeline__cue">{{ props.state.current.coachCue }}</text>
      </view>

      <view class="workout-timeline__next">
        <text class="workout-timeline__next-label">接下来</text>
        <text class="workout-timeline__next-title">
          {{ props.state.next?.title ?? '完成训练' }}
        </text>
      </view>
    </view>

    <view class="workout-timeline__progress">
      <view class="workout-timeline__progress-value" :style="progressStyle" />
    </view>
  </view>
</template>

<style scoped>
.workout-timeline {
  box-sizing: border-box;
}

.workout-timeline__row {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 16rpx;
}

.workout-timeline__main {
  flex: 1;
  min-width: 0;
}

.workout-timeline__step {
  display: flex;
  align-items: center;
  gap: 18rpx;
  color: #74685c;
  font-size: 18rpx;
  font-weight: 800;
}

.workout-timeline__time {
  color: #c84f4f;
  font-variant-numeric: tabular-nums;
}

.workout-timeline__title,
.workout-timeline__cue,
.workout-timeline__next-label,
.workout-timeline__next-title {
  display: block;
}

.workout-timeline__title {
  margin-top: 4rpx;
  color: #20344f;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.2;
}

.workout-timeline__cue {
  margin-top: 8rpx;
  overflow: hidden;
  color: #675d52;
  font-size: 20rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workout-timeline__next {
  display: flex;
  width: 100%;
  align-items: baseline;
  gap: 14rpx;
  min-width: 0;
}

.workout-timeline__next-label {
  color: #8c765f;
  font-size: 17rpx;
  font-weight: 700;
}

.workout-timeline__next-title {
  min-width: 0;
  margin-top: 0;
  overflow: hidden;
  color: #20344f;
  font-size: 21rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workout-timeline__progress {
  height: 6rpx;
  margin-top: 20rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(32, 52, 79, 0.12);
}

.workout-timeline__progress-value {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: #28766a;
  transform-origin: left center;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
