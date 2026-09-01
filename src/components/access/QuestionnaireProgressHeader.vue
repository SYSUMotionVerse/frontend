<script setup lang="ts">
defineProps<{
  questionnaireTitle: string
  questionnaireCount: number
  questionnaireNumber: number
  completedQuestionCount: number
  totalQuestionCount: number
  estimatedMinutes: number
  progressPercent: number
}>()
</script>

<template>
  <view class="questionnaire-progress bg-white chunky-shadow" aria-live="polite">
    <view class="questionnaire-progress__topline">
      <view class="questionnaire-progress__step-group">
        <text class="questionnaire-progress__step">
          第 {{ questionnaireNumber }} / {{ questionnaireCount }} 份
        </text>
      </view>
      <text class="questionnaire-progress__time">
        全程约 {{ estimatedMinutes }} 分钟
      </text>
    </view>
    <text class="questionnaire-progress__title">{{ questionnaireTitle }}</text>
    <view class="questionnaire-progress__detail">
      <text>已完成 {{ completedQuestionCount }} / {{ totalQuestionCount }} 题</text>
      <text>{{ progressPercent }}%</text>
    </view>
    <view class="questionnaire-progress__track">
      <view
        class="questionnaire-progress__fill"
        :style="{ width: `${progressPercent}%` }"
      />
    </view>
  </view>
</template>

<style scoped>
.questionnaire-progress {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 30rpx 32rpx;
  border: 4rpx solid rgba(255, 211, 132, 0.24);
  border-radius: 32rpx;
}

.questionnaire-progress__topline,
.questionnaire-progress__detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.questionnaire-progress__step-group {
  display: flex;
  min-height: 0;
  align-items: center;
  gap: 12rpx;
}

.questionnaire-progress__step {
  color: #C35F6B;
  font-size: 24rpx;
  font-weight: 900;
}

.questionnaire-progress__time,
.questionnaire-progress__detail {
  color: #64748B;
  font-size: 24rpx;
  font-weight: 700;
}

.questionnaire-progress__title {
  color: #1A202C;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.35;
}

.questionnaire-progress__track {
  height: 12rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(255, 211, 132, 0.28);
}

.questionnaire-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: #FF8B8B;
  transition: width 180ms ease-out;
}
</style>
