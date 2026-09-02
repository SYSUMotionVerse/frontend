<script setup lang="ts">
import { computed } from 'vue'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import type { ScoredActionResult } from '../../domain/training/actionScoringTypes'
import TrainingFeedbackBodyMap from './TrainingFeedbackBodyMap.vue'
import TrainingFeedbackTrendChart from './TrainingFeedbackTrendChart.vue'

const props = defineProps<{
  action: ScoredActionResult
  index: number
  expanded: boolean
  trend: Array<{ date: string; score: number }>
}>()

defineEmits<{
  toggle: []
}>()

const angleLabels: Record<string, string> = {
  left_elbow: '左肘',
  right_elbow: '右肘',
  left_shoulder: '左肩',
  right_shoulder: '右肩',
  left_hip: '左髋',
  right_hip: '右髋',
  left_knee: '左膝',
  right_knee: '右膝',
  torso_rotation: '躯干旋转'
}

const angles = computed(() => Object.entries(props.action.angleDetails)
  .filter((entry): entry is [string, NonNullable<(typeof props.action.angleDetails)[keyof typeof props.action.angleDetails]>] => Boolean(entry[1]))
  .map(([key, detail]) => ({
    key,
    label: angleLabels[key] ?? key,
    score: detail.score
  })))

const chartId = computed(() => `action-trend-${props.index}-${props.action.itemId}`)
</script>

<template>
  <view class="feedback-action" :class="{ 'feedback-action--expanded': expanded }">
    <button class="feedback-action__summary" type="button" @click="$emit('toggle')">
      <view class="feedback-action__index">{{ String(index + 1).padStart(2, '0') }}</view>
      <view class="feedback-action__copy">
        <text class="feedback-action__title">{{ action.title }}</text>
        <text class="feedback-action__meta">{{ angles.length }} 个角度参与评分</text>
      </view>
      <view class="feedback-action__score">
        <text class="feedback-action__score-value">{{ Math.round(action.score) }}</text>
        <text class="feedback-action__score-unit">分</text>
      </view>
      <view class="feedback-action__arrow">
        <uni-icons :type="expanded ? 'top' : 'bottom'" size="16" color="#718096" />
      </view>
    </button>

    <view v-if="expanded" class="feedback-action__details">
      <view class="feedback-action__section-head">
        <view>
          <text class="feedback-action__eyebrow">身体部位</text>
          <text class="feedback-action__section-title">角度评分</text>
        </view>
        <text class="feedback-action__scale">0—100</text>
      </view>
      <TrainingFeedbackBodyMap :angles="angles" />

      <view class="feedback-action__trend">
        <view class="feedback-action__section-head">
          <view>
            <text class="feedback-action__eyebrow">历史变化</text>
            <text class="feedback-action__section-title">本动作得分趋势</text>
          </view>
        </view>
        <TrainingFeedbackTrendChart :chart-id="chartId" :points="trend" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.feedback-action {
  overflow: hidden;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 18rpx rgba(71, 56, 39, 0.04);
}

.feedback-action__summary,
.feedback-action__index,
.feedback-action__score,
.feedback-action__section-head {
  display: flex;
  align-items: center;
}

.feedback-action__summary {
  width: 100%;
  min-height: 112rpx;
  gap: 16rpx;
  margin: 0;
  padding: 18rpx 20rpx;
  border: 0;
  background: transparent;
  box-sizing: border-box;
  color: #203042;
  text-align: left;
}

.feedback-action__summary::after { display: none; }

.feedback-action__index {
  width: 54rpx;
  height: 54rpx;
  flex: none;
  justify-content: center;
  border-radius: 18rpx;
  background: #ffe8e5;
  color: #b75d56;
  font-size: 20rpx;
  font-weight: 900;
}

.feedback-action__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.feedback-action__title {
  overflow: hidden;
  color: #203042;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.28;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-action__meta,
.feedback-action__scale {
  color: #8a97a8;
  font-size: 19rpx;
  font-weight: 700;
}

.feedback-action__score {
  flex: none;
  align-items: baseline;
  gap: 3rpx;
}

.feedback-action__score-value {
  color: #ff7d7d;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1;
}

.feedback-action__score-unit,
.feedback-action__arrow {
  color: #718096;
  font-size: 19rpx;
  font-weight: 800;
}

.feedback-action__arrow {
  width: 24rpx;
  flex: none;
  font-size: 25rpx;
  text-align: center;
}

.feedback-action__details {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 24rpx;
  border-top: 2rpx solid rgba(226, 232, 240, 0.86);
}

.feedback-action__section-head {
  justify-content: space-between;
  gap: 20rpx;
}

.feedback-action__section-head > view,
.feedback-action__trend {
  display: flex;
  flex-direction: column;
}

.feedback-action__section-head > view { gap: 4rpx; }
.feedback-action__trend { gap: 14rpx; padding-top: 6rpx; }

.feedback-action__eyebrow {
  color: #c76b5b;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.feedback-action__section-title {
  color: #203042;
  font-size: 26rpx;
  font-weight: 900;
}
</style>
