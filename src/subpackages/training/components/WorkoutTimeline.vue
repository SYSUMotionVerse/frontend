<script setup lang="ts">
import { computed } from 'vue'
import type { VisualWorkoutState } from '../../../features/training/visualWorkoutTimeline'

const props = defineProps<{
  state: VisualWorkoutState
}>()

const actionSegments = computed(() => Array.from(
  { length: props.state.totalActions },
  (_, index) => index + 1
))

const phaseDurationSeconds = computed(() => Math.max(
  1,
  props.state.current.endSeconds - props.state.current.startSeconds
))

const phaseElapsedSeconds = computed(() => props.state.phaseElapsedSeconds)
const sessionElapsedSeconds = computed(() => props.state.sessionElapsedSeconds)

const phaseProgressStyle = computed(() => ({
  transform: `scaleX(${props.state.phaseProgressPercent / 100})`
}))

const currentStatusLabel = computed(() => {
  if (props.state.current.kind === 'active') return '正在进行'
  if (props.state.current.kind === 'demonstration') return '预训练示范'
  if (props.state.current.kind === 'countdown') return '准备开始'
  return '等待开始'
})

const currentTitle = computed(() => normalizeTitle(props.state.current.title))
const nextTitle = computed(() => props.state.next
  ? normalizeTitle(props.state.next.title)
  : '完成训练'
)

function normalizeTitle(title: string) {
  return title.replace(/^(预训练倒计时|预训练示范|正式训练倒计时|正式训练)：\s*/, '')
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
</script>

<template>
  <view class="workout-timeline">
    <view class="workout-timeline__overview-head">
      <text class="workout-timeline__overview-title">动作进度</text>
      <text class="workout-timeline__overview-count">
        {{ props.state.actionNumber }} / {{ props.state.totalActions }}
      </text>
    </view>

    <view class="workout-timeline__segments" aria-hidden="true">
      <view
        v-for="segment in actionSegments"
        :key="segment"
        class="workout-timeline__segment"
        :class="{ 'workout-timeline__segment--active': segment <= props.state.actionNumber }"
      />
    </view>

    <view class="workout-timeline__metrics">
      <view class="workout-timeline__metric">
        <text class="workout-timeline__metric-label">已训练</text>
        <text class="workout-timeline__metric-value">
          {{ formatDuration(sessionElapsedSeconds) }}
        </text>
      </view>
      <view class="workout-timeline__metric workout-timeline__metric--phase">
        <text class="workout-timeline__metric-label">当前动作</text>
        <text class="workout-timeline__metric-value workout-timeline__metric-value--phase">
          {{ formatDuration(phaseElapsedSeconds) }} / {{ formatDuration(phaseDurationSeconds) }}
        </text>
        <view class="workout-timeline__phase-track" aria-hidden="true">
          <view class="workout-timeline__phase-value" :style="phaseProgressStyle" />
        </view>
      </view>
    </view>

    <view class="workout-timeline__current">
      <view class="workout-timeline__current-status">
        <view class="workout-timeline__status-dot" />
        <text>{{ currentStatusLabel }}</text>
      </view>
      <text class="workout-timeline__current-title">{{ currentTitle }}</text>
    </view>

    <view class="workout-timeline__next">
      <text class="workout-timeline__next-label">接下来</text>
      <text class="workout-timeline__next-title">{{ nextTitle }}</text>
    </view>
  </view>
</template>

<style scoped>
.workout-timeline {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  box-sizing: border-box;
}

.workout-timeline__overview-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
}

.workout-timeline__overview-title,
.workout-timeline__overview-count {
  color: #20344f;
  font-weight: 900;
  line-height: 1.15;
}

.workout-timeline__overview-title { font-size: 25rpx; }

.workout-timeline__overview-count {
  font-size: 30rpx;
  font-variant-numeric: tabular-nums;
}

.workout-timeline__segments {
  display: flex;
  gap: 7rpx;
  margin-top: 18rpx;
}

.workout-timeline__segment {
  height: 9rpx;
  min-width: 0;
  flex: 1;
  border-radius: 9999px;
  background: #ddd7d0;
}

.workout-timeline__segment--active { background: #ff7468; }

.workout-timeline__metrics {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
  padding: 18rpx 0;
  border-top: 2rpx solid rgba(32, 52, 79, 0.08);
  border-bottom: 2rpx solid rgba(32, 52, 79, 0.08);
}

.workout-timeline__metric {
  display: flex;
  min-width: 0;
  flex: 0.85;
  flex-direction: column;
  gap: 6rpx;
}

.workout-timeline__metric--phase {
  flex: 1.35;
  padding-left: 16rpx;
  border-left: 2rpx solid rgba(32, 52, 79, 0.1);
}

.workout-timeline__metric-label {
  color: #8a97a8;
  font-size: 17rpx;
  font-weight: 700;
}

.workout-timeline__metric-value {
  color: #20344f;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.workout-timeline__metric-value--phase { font-size: 20rpx; }

.workout-timeline__phase-track {
  height: 6rpx;
  margin-top: 2rpx;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(32, 52, 79, 0.12);
}

.workout-timeline__phase-value {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: #ff7468;
  transform-origin: left center;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.workout-timeline__current {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
  padding: 20rpx 0 18rpx;
  border-bottom: 2rpx solid rgba(32, 52, 79, 0.08);
}

.workout-timeline__current-status {
  display: flex;
  align-items: center;
  gap: 9rpx;
  color: #ff6f62;
  font-size: 19rpx;
  font-weight: 900;
}

.workout-timeline__status-dot {
  width: 16rpx;
  height: 16rpx;
  flex: none;
  border-radius: 9999px;
  background: #ff7468;
}

.workout-timeline__current-title {
  display: -webkit-box;
  overflow: hidden;
  color: #20344f;
  font-size: 39rpx;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.08;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.workout-timeline__next {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
  padding-top: 16rpx;
}

.workout-timeline__next-label {
  color: #a9b0ba;
  font-size: 17rpx;
  font-weight: 700;
}

.workout-timeline__next-title {
  display: block;
  overflow: hidden;
  color: #9aa6b5;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.28;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
