<script setup lang="ts">
import { computed } from 'vue'
import type { CheckpointKey } from '../../types/student'
import { CHECKPOINT_LABELS } from '../../features/access/questionnaire'

interface Props {
  checkpoint: CheckpointKey
  score: number
  percentage: number
  submittedAt?: string
  questionnaireCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  continue: []
}>()

const level = computed(() => {
  if (props.percentage >= 85) {
    return '优秀势头'
  }

  if (props.percentage >= 65) {
    return '进步良好'
  }

  return '需要加强'
})

const checkpointLabel = computed(() => CHECKPOINT_LABELS[props.checkpoint])
const isQuestionnaireSet = computed(() => (props.questionnaireCount ?? 1) > 1)
const submittedAtLabel = computed(() => {
  if (!props.submittedAt) {
    return ''
  }

  const parsedDate = new Date(props.submittedAt)
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleString()
})

function handleContinue() {
  emit('continue')
}
</script>

<template>
  <view class="card-shell result-card">
    <view class="result-card__hero-badge">
      <text>🏅</text>
    </view>
    <view class="result-card__sticker">
      <text>评估点</text>
    </view>

    <view class="result-card__hero text-center">
      <view class="chip-soft bg-brand-teal/15 text-[#2B7CB8] border-2 border-brand-teal/25 mx-auto mb-[32rpx]">
        <text>{{ checkpointLabel }} 评估</text>
      </view>

      <template v-if="isQuestionnaireSet">
        <text class="block text-[76rpx] font-900 text-brand-coral">
          {{ questionnaireCount }} 份已完成
        </text>
        <text class="block mt-[16rpx] text-[32rpx] font-800 text-slate-600">
          答案已按各量表分别保存，不生成未经验证的综合心理分数。
        </text>
      </template>
      <template v-else>
        <text class="block text-[144rpx] font-900 text-brand-coral">{{ percentage }}%</text>
        <text class="block mt-[16rpx] text-[48rpx] font-800 text-slate-600">分数：{{ score }}</text>
      </template>
    </view>

    <view class="result-card__summary-grid">
      <view v-if="!isQuestionnaireSet" class="result-card__score-tile">
        <text class="block text-[24rpx] uppercase tracking-widest text-white/60 font-800">评估得分</text>
        <text class="block mt-[20rpx] text-[40rpx] font-900 text-white">{{ level }}</text>
      </view>
      <view class="result-card__score-tile result-card__score-tile--soft">
        <text class="block text-[24rpx] uppercase tracking-widest text-[#2B7CB8] font-800">提交时间</text>
        <text v-if="submittedAtLabel" class="block text-[32rpx] text-slate-500 font-800">
          {{ submittedAtLabel }}
        </text>
        <text v-else class="block text-[32rpx] text-slate-500 font-800">
          刚刚生成
        </text>
      </view>
    </view>

    <view v-if="!isQuestionnaireSet" class="mt-[32rpx] inline-flex items-center gap-[16rpx] px-[40rpx] py-[16rpx] bg-brand-leaf/15 rounded-full border-2 border-brand-leaf/25 self-center">
      <text class="text-[40rpx] font-900 text-[#065F46]">{{ level }}</text>
    </view>

    <button
      class="btn-primary mt-[48rpx] result-card__cta"
      type="button"
      @click="handleContinue"
    >
      <text>继续前往首页 ✨</text>
    </button>
  </view>
</template>

<style scoped>
.result-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  text-align: center;
}

.result-card__hero-badge {
  display: inline-flex;
  width: 132rpx;
  height: 132rpx;
  align-self: center;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 8rpx solid #ffffff;
  background: rgba(255, 211, 132, 0.22);
  box-shadow: 0 12rpx 0 rgba(255, 211, 132, 0.18);
  font-size: 60rpx;
}

.result-card__sticker {
  display: inline-flex;
  width: fit-content;
  align-self: center;
  align-items: center;
  justify-content: center;
  padding: 10rpx 22rpx;
  border-radius: 9999px;
  border: 4rpx solid #ffffff;
  background: #89cfff;
  box-shadow: 0 8rpx 0 rgba(137, 207, 255, 0.2);
  color: #1a202c;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transform: rotate(4deg);
}

.result-card__hero {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.result-card__summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.result-card__score-tile {
  flex: 1 1 240rpx;
  min-width: 0;
  display: flex;
  min-height: 180rpx;
  flex-direction: column;
  justify-content: center;
  border-radius: 40rpx;
  padding: 32rpx;
  background: #1A202C;
  box-shadow: 0 10rpx 0 rgba(26, 32, 44, 0.12);
}

.result-card__score-tile--soft {
  border: 6rpx solid rgba(137, 207, 255, 0.22);
  background: rgba(137, 207, 255, 0.12);
  box-shadow: none;
}

.result-card__cta::after {
  display: none;
}

.result-card__cta {
  margin-top: 64rpx;
}
</style>
