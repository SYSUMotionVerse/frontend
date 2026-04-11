<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { PsychologyQuestionnaireModel } from '../../uni-app/api/studentBackendTypes'

interface SubmissionPayload {
  scaleId: number
  answers: Record<number, number>
  title: string
}

const props = defineProps<{
  questionnaire: PsychologyQuestionnaireModel
}>()

const emit = defineEmits<{
  submit: [payload: SubmissionPayload]
}>()

const answers = reactive<Record<number, number>>({})

for (const question of props.questionnaire.questions) {
  answers[question.id] = 0
}

const isComplete = computed(() => Object.values(answers).every((value) => value > 0))

function handleSubmit() {
  if (!isComplete.value) {
    return
  }

  emit('submit', {
    scaleId: props.questionnaire.scaleId,
    answers: { ...answers },
    title: props.questionnaire.title
  })
}

function handleResponseChange(questionId: number, optionId: number) {
  answers[questionId] = optionId
}
</script>

<template>
  <form class="long-questionnaire-form" @submit.prevent="handleSubmit">
    <view
      v-for="question in questionnaire.questions"
      :key="question.id"
      class="long-questionnaire-form__card bg-white rounded-[32rpx] border-4 border-brand-gold/20 chunky-shadow"
    >
      <text class="long-questionnaire-form__prompt block text-[36rpx] font-800 text-[#1A202C] tracking-tight">{{ question.prompt }}</text>
      
      <view class="long-questionnaire-form__options">
        <button
          v-for="option in question.options"
          :key="option.id"
          class="long-questionnaire-form__option"
          :class="{ 'long-questionnaire-form__option--selected': answers[question.id] === option.id }"
          type="button"
          @click="handleResponseChange(question.id, option.id)"
        >
          <text class="long-questionnaire-form__option-label">{{ option.label }}</text>
        </button>
      </view>
    </view>

    <view class="long-questionnaire-form__actions">
      <button form-type="submit" class="btn-primary" :disabled="!isComplete">
        <text v-if="!isComplete">请先完成所有问题</text>
        <text v-else>提交答案</text>
      </button>
    </view>
  </form>
</template>

<style scoped>
.long-questionnaire-form {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.long-questionnaire-form__card {
  display: flex;
  flex-direction: column;
  padding: 44rpx 40rpx;
}

.long-questionnaire-form__prompt {
  line-height: 1.3;
  margin-bottom: 40rpx;
}

.long-questionnaire-form__options {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.long-questionnaire-form__option {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  border: 6rpx solid rgba(255, 211, 132, 0.22);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.98);
  padding: 24rpx 28rpx;
  text-align: left;
}

.long-questionnaire-form__option--selected {
  border-color: rgba(217, 119, 6, 0.45);
  background: rgba(255, 211, 132, 0.18);
}

.long-questionnaire-form__option::after {
  display: none;
}

.long-questionnaire-form__option-label {
  color: #1A202C;
  font-size: 30rpx;
  line-height: 1.45;
  font-weight: 700;
}

.long-questionnaire-form__actions {
  margin-top: 40rpx;
  padding-bottom: 72rpx;
}
</style>
