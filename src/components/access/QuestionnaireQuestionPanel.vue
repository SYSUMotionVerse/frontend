<script setup lang="ts">
import { computed } from 'vue'
import type {
  PsychologyQuestionnaireAnswer,
  PsychologyQuestionnaireQuestion
} from '../../uni-app/api/studentBackendTypes'

const props = defineProps<{
  question: PsychologyQuestionnaireQuestion
  answer: PsychologyQuestionnaireAnswer
  questionNumber: number
  questionCount: number
}>()

const emit = defineEmits<{
  select: [questionId: number, optionId: number]
  integerInput: [value: string]
  durationInput: [field: 'hours' | 'minutes', value: string]
}>()

const inputType = computed(() =>
  String(props.question.responseConfig?.input_type ?? '')
)
const usesFivePointLegend = computed(() => {
  const scores = props.question.options.map(option => option.score)
  return scores.length === 5
    && new Set(scores).size === 5
    && [...scores].sort((left, right) => left - right).every(
      (score, index) => score === index + 1
    )
})
const integerValue = computed(() =>
  typeof props.answer === 'string' && !props.answer.startsWith('{')
    ? props.answer
    : ''
)
const durationValue = computed(() => {
  if (typeof props.answer !== 'string' || !props.answer.startsWith('{')) {
    return { hours: '', minutes: '' }
  }
  try {
    const parsed = JSON.parse(props.answer) as { hours?: number; minutes?: number }
    return {
      hours: parsed.hours === undefined ? '' : String(parsed.hours),
      minutes: parsed.minutes === undefined ? '' : String(parsed.minutes)
    }
  } catch {
    return { hours: '', minutes: '' }
  }
})

function isOptionSelected(optionId: number) {
  return Array.isArray(props.answer)
    ? props.answer.includes(optionId)
    : props.answer === optionId
}

function optionCode(score: number, index: number) {
  return usesFivePointLegend.value ? String(score) : String.fromCharCode(65 + index)
}

function inputEventValue(event: unknown) {
  const detail = (event as { detail?: { value?: unknown } }).detail
  return String(detail?.value ?? '')
}
</script>

<template>
  <view class="questionnaire-question bg-white chunky-shadow">
    <text class="questionnaire-question__progress">
      {{ questionNumber }} / {{ questionCount }}
    </text>
    <text class="questionnaire-question__prompt">{{ question.prompt }}</text>

    <view v-if="question.questionType !== 'TEXT'" class="questionnaire-runner__options">
      <button
        v-for="(option, optionIndex) in question.options"
        :key="option.id"
        class="questionnaire-runner__option"
        :class="{ 'questionnaire-runner__option--selected': isOptionSelected(option.id) }"
        :aria-label="`${optionCode(option.score, optionIndex)}：${option.label}`"
        :aria-pressed="isOptionSelected(option.id)"
        type="button"
        @click="emit('select', question.id, option.id)"
      >
        <text class="questionnaire-runner__option-code">
          {{ optionCode(option.score, optionIndex) }}
        </text>
        <text class="questionnaire-runner__option-label">{{ option.label }}</text>
      </button>
    </view>

    <view v-else-if="inputType === 'duration'" class="questionnaire-runner__duration">
      <label class="questionnaire-runner__field">
        <text class="questionnaire-runner__field-label">小时</text>
        <view class="questionnaire-runner__input-wrap">
          <input
            type="number"
            inputmode="numeric"
            :value="durationValue.hours"
            placeholder="0"
            @input="emit('durationInput', 'hours', inputEventValue($event))"
          >
          <text>小时</text>
        </view>
      </label>
      <label class="questionnaire-runner__field">
        <text class="questionnaire-runner__field-label">分钟</text>
        <view class="questionnaire-runner__input-wrap">
          <input
            type="number"
            inputmode="numeric"
            :value="durationValue.minutes"
            placeholder="0"
            @input="emit('durationInput', 'minutes', inputEventValue($event))"
          >
          <text>分钟</text>
        </view>
      </label>
    </view>

    <label v-else class="questionnaire-runner__field questionnaire-runner__field--single">
      <text class="questionnaire-runner__field-label">
        {{ question.responseConfig?.unit || '请输入答案' }}
      </text>
      <view class="questionnaire-runner__input-wrap">
        <input
          type="number"
          inputmode="numeric"
          :value="integerValue"
          placeholder="请输入"
          @input="emit('integerInput', inputEventValue($event))"
        >
        <text v-if="question.responseConfig?.unit">{{ question.responseConfig.unit }}</text>
      </view>
    </label>
  </view>
</template>

<style scoped>
.questionnaire-question {
  display: flex;
  flex-direction: column;
  padding: 36rpx 32rpx;
  border: 4rpx solid rgba(255, 211, 132, 0.24);
  border-radius: 32rpx;
}

.questionnaire-question__prompt {
  color: #1A202C;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1.55;
}

.questionnaire-question__progress {
  margin-bottom: 12rpx;
  color: #c35f6b;
  font-size: 23rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.questionnaire-runner__options {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 28rpx;
}

.questionnaire-runner__option {
  display: flex;
  width: 100%;
  min-height: 92rpx;
  align-items: center;
  gap: 18rpx;
  box-sizing: border-box;
  margin: 0;
  border: 4rpx solid #E9E2DE;
  border-radius: 24rpx;
  background: #FFFCF8;
  color: #1A202C;
  padding: 18rpx 22rpx;
  text-align: left;
}

.questionnaire-runner__option::after {
  border: none;
}

.questionnaire-runner__option--selected {
  border-color: #FF8B8B;
}

.questionnaire-runner__option-code {
  display: inline-flex;
  width: 44rpx;
  height: 44rpx;
  flex: 0 0 44rpx;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #DED8D4;
  border-radius: 50%;
  color: #6F6870;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 44rpx;
  text-align: center;
}

.questionnaire-runner__option--selected .questionnaire-runner__option-code {
  border-color: #FF8B8B;
  color: #FF8B8B;
}

.questionnaire-runner__option-label {
  min-width: 0;
  flex: 1;
  color: inherit;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.45;
}

.questionnaire-runner__duration {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 30rpx;
}

.questionnaire-runner__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
}

.questionnaire-runner__field--single {
  margin-top: 30rpx;
}

.questionnaire-runner__field-label {
  margin-left: 32rpx;
  color: #1A202C;
  font-size: 25rpx;
  font-weight: 900;
}

.questionnaire-runner__input-wrap {
  display: flex;
  min-height: 88rpx;
  align-items: center;
  box-sizing: border-box;
  border: 6rpx solid #FFEAC2;
  border-radius: 999rpx;
  background: #F8FAFC;
  padding: 0 36rpx;
  color: #64748B;
  font-size: 23rpx;
}

.questionnaire-runner__input-wrap input {
  min-width: 0;
  height: 88rpx;
  flex: 1;
  color: #1A202C;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
