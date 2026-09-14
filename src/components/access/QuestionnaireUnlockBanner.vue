<script setup lang="ts">
import { computed } from 'vue'
import type { CheckpointKey } from '../../types/student'

const props = withDefaults(defineProps<{
  compact?: boolean
  checkpoint?: CheckpointKey
  available?: boolean
  scheduledAt?: string | null
}>(), {
  compact: false,
  available: true,
  scheduledAt: null
})

const emit = defineEmits<{
  continueQuestionnaire: []
}>()

const checkpointLabels: Partial<Record<CheckpointKey, string>> = {
  daily: '今日问卷',
  week4: '第 4 周随访问卷',
  week8: '第 8 周随访问卷',
  week12: '第 12 周随访问卷'
}

const isFollowUp = computed(() => Boolean(props.checkpoint && props.checkpoint !== 'baseline'))
const checkpointLabel = computed(() => (
  props.checkpoint ? checkpointLabels[props.checkpoint] ?? '研究问卷' : '研究问卷'
))
const scheduledLabel = computed(() => {
  if (!props.scheduledAt) return '稍后开放'
  const scheduledAt = new Date(props.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) return '稍后开放'
  return `${scheduledAt.getMonth() + 1} 月 ${scheduledAt.getDate()} 日 ${scheduledAt.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })} 开放`
})
</script>

<template>
  <view
    class="questionnaire-unlock"
    :class="{ 'questionnaire-unlock--compact': props.compact }"
  >
    <view class="questionnaire-unlock__copy">
      <text class="questionnaire-unlock__eyebrow">
        {{ isFollowUp ? '研究问卷提醒' : '预览模式' }}
      </text>
      <text class="questionnaire-unlock__title">
        {{ !isFollowUp
          ? '先逛一逛，完成问卷后就能开练'
          : props.available ? `${checkpointLabel}已开放`
            : `${checkpointLabel}暂未开放` }}
      </text>
      <text v-if="!props.compact && !isFollowUp" class="questionnaire-unlock__description">
        你可以先浏览训练项目和成长内容。填写完问卷后，就能开始训练并查看自己的成长记录。
      </text>
      <text v-else-if="!props.compact && props.available" class="questionnaire-unlock__description">
        随访问卷不会影响今天的训练，你可以现在填写，也可以稍后从这里进入。
      </text>
      <text v-else-if="!props.compact" class="questionnaire-unlock__description">
        {{ scheduledLabel }}。开放后会在这里显示填写入口，当前可以继续训练。
      </text>
    </view>
    <button
      v-if="props.available"
      class="questionnaire-unlock__action"
      type="button"
      @click="emit('continueQuestionnaire')"
    >
      去完成问卷
    </button>
  </view>
</template>

<style scoped>
.questionnaire-unlock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  border: 2rpx solid rgba(40, 118, 106, 0.22);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  padding: 28rpx 30rpx;
}

.questionnaire-unlock--compact {
  align-items: flex-start;
  flex-direction: column;
}

.questionnaire-unlock__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.questionnaire-unlock__eyebrow {
  color: #28766a;
  font-size: 21rpx;
  font-weight: 900;
}

.questionnaire-unlock__title {
  margin-top: 8rpx;
  color: #20344f;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.4;
}

.questionnaire-unlock__description {
  margin-top: 8rpx;
  color: #53635f;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.5;
}

.questionnaire-unlock__action {
  display: inline-flex;
  min-height: 72rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 0;
  border-radius: 999rpx;
  background: #fffaf4;
  color: #28766a;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.2;
  padding: 0 24rpx;
}

.questionnaire-unlock__action::after {
  border: none;
}
</style>
