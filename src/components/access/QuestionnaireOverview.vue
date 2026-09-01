<script setup lang="ts">
import { computed } from 'vue'
import type {
  BackendQuestionnairePlan,
  PsychologyQuestionnaireModel
} from '../../uni-app/api/studentBackendTypes'

const props = defineProps<{
  plan: BackendQuestionnairePlan | null
  currentQuestionnaire: PsychologyQuestionnaireModel
  startLabel?: string
}>()

const emit = defineEmits<{
  start: []
}>()

const questionnaireItems = computed(() => {
  if (props.plan?.questionnaires?.length) {
    return props.plan.questionnaires
  }

  return [{
    id: props.currentQuestionnaire.scaleId,
    code: null,
    title: props.currentQuestionnaire.title,
    short_title: props.currentQuestionnaire.shortTitle ?? '',
    description: props.currentQuestionnaire.description,
    order: 1,
    estimated_minutes: props.currentQuestionnaire.estimatedMinutes ?? 3,
    question_count: props.currentQuestionnaire.questions?.length ?? 0,
    completed: false
  }]
})

const questionnaireCount = computed(() =>
  props.plan?.questionnaire_count ?? questionnaireItems.value.length
)
const estimatedMinutes = computed(() =>
  props.plan?.estimated_total_minutes
    ?? questionnaireItems.value.reduce((total, item) => total + item.estimated_minutes, 0)
)
</script>

<template>
  <view class="questionnaire-overview">
    <view class="questionnaire-overview__intro">
      <text class="questionnaire-overview__intro-title">开始前，请了解这些</text>
      <text>
        本阶段共有 {{ questionnaireCount }} 份问卷，预计约 {{ estimatedMinutes }} 分钟。
        问卷会逐份完成，每次只呈现一道题。
      </text>
      <text>你的答案会自动保存，短暂离开后也可以继续填写。</text>
    </view>

    <view class="questionnaire-overview__section-heading">
      <text class="questionnaire-overview__section-title">本次问卷</text>
      <text class="questionnaire-overview__section-meta">
        {{ questionnaireCount }} 份 · 约 {{ estimatedMinutes }} 分钟
      </text>
    </view>

    <view class="questionnaire-overview__list">
      <view
        v-for="(item, itemIndex) in questionnaireItems"
        :key="item.id"
        class="questionnaire-overview__item"
        :class="{ 'questionnaire-overview__item--completed': item.completed }"
      >
        <view class="questionnaire-overview__item-index">
          <text>{{ itemIndex + 1 }}</text>
        </view>
        <view class="questionnaire-overview__item-copy">
          <view class="questionnaire-overview__item-heading">
            <text class="questionnaire-overview__item-title">{{ item.title }}</text>
            <text v-if="item.completed" class="questionnaire-overview__item-status">已完成</text>
          </view>
          <text v-if="item.description" class="questionnaire-overview__item-description">
            {{ item.description }}
          </text>
          <view class="questionnaire-overview__item-meta">
            <text>{{ item.question_count }} 题</text>
            <text>约 {{ item.estimated_minutes }} 分钟</text>
          </view>
        </view>
      </view>
    </view>

    <button class="questionnaire-overview__start btn-primary" type="button" @click="emit('start')">
      <text>{{ startLabel || '开始填写' }}</text>
    </button>
  </view>
</template>

<style scoped>
.questionnaire-overview {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.questionnaire-overview__intro,
.questionnaire-overview__item {
  border: 4rpx solid rgba(255, 211, 132, 0.24);
  background: rgba(255, 252, 248, 0.96);
  box-shadow: 0 8rpx 0 rgba(0, 0, 0, 0.05);
}

.questionnaire-overview__intro {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 28rpx 30rpx;
  border-radius: 28rpx;
  color: #64748b;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.6;
}

.questionnaire-overview__intro-title,
.questionnaire-overview__section-title {
  color: #1a202c;
  font-weight: 900;
}

.questionnaire-overview__intro-title {
  font-size: 32rpx;
}

.questionnaire-overview__section-heading,
.questionnaire-overview__item-heading,
.questionnaire-overview__item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.questionnaire-overview__section-heading {
  padding: 0 12rpx;
}

.questionnaire-overview__section-title {
  font-size: 32rpx;
}

.questionnaire-overview__section-meta {
  color: #7a8799;
  font-size: 22rpx;
  font-weight: 700;
}

.questionnaire-overview__list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.questionnaire-overview__item {
  display: flex;
  gap: 20rpx;
  padding: 26rpx 28rpx;
  border-radius: 28rpx;
}

.questionnaire-overview__item--completed {
  border-color: rgba(118, 174, 112, 0.3);
  background: rgba(239, 249, 235, 0.94);
}

.questionnaire-overview__item-index {
  display: inline-flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 139, 139, 0.14);
  color: #c35f6b;
  font-size: 22rpx;
  font-weight: 900;
}

.questionnaire-overview__item-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
}

.questionnaire-overview__item-heading {
  gap: 16rpx;
}

.questionnaire-overview__item-title {
  min-width: 0;
  flex: 1;
  color: #1a202c;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.35;
}

.questionnaire-overview__item-status {
  flex: none;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(118, 174, 112, 0.16);
  color: #357652;
  font-size: 20rpx;
  font-weight: 800;
}

.questionnaire-overview__item-description {
  color: #64748b;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.5;
}

.questionnaire-overview__item-meta {
  justify-content: flex-start;
  gap: 24rpx;
  color: #8290a3;
  font-size: 21rpx;
  font-weight: 700;
}

.questionnaire-overview__start {
  width: 100%;
  margin: 8rpx 0 48rpx;
}

.questionnaire-overview__start::after {
  border: none;
}
</style>
