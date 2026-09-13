<script setup lang="ts">
import { computed, reactive } from 'vue'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'

type RatingField = 'feelingScale' | 'feltArousalScale'
type SubmissionStatus = 'idle' | 'error' | 'saved-locally' | 'submitted'
type StatusAction = 'retry' | 'home' | 'feedback'

const emit = defineEmits<{
  submit: [payload: { feelingScale: number; feltArousalScale: number }]
  openFeedback: []
  goHome: []
}>()

const props = withDefaults(defineProps<{
  submitting?: boolean
  status?: SubmissionStatus
  statusMessage?: string
  statusAction?: StatusAction
  timing?: 'PRE' | 'POST'
}>(), {
  submitting: false,
  status: 'idle',
  statusMessage: '',
  statusAction: 'retry',
  timing: 'POST'
})

const form = reactive({
  feelingScale: 0,
  feltArousalScale: 3
})

const questionSections: Array<{
  field: RatingField
  index: string
  title: string
  hint: string
  values: number[]
  lowLabel: string
  highLabel: string
}> = [
  {
    field: 'feelingScale',
    index: '01',
    title: '总体主观感受',
    hint: '评价此刻总体感觉的愉快或不愉快程度',
    values: Array.from({ length: 11 }, (_, index) => index - 5),
    lowLabel: '-5 非常糟糕',
    highLabel: '+5 非常好'
  },
  {
    field: 'feltArousalScale',
    index: '02',
    title: '激活／唤醒状态',
    hint: '评价此刻身体和心理的激活／唤醒程度',
    values: [1, 2, 3, 4, 5, 6],
    lowLabel: '1 非常低',
    highLabel: '6 非常高'
  }
]

const hasPersistentStatusMessage = computed(() => (
  !isOpeningFeedback.value
  && props.status !== 'idle'
  && Boolean(props.statusMessage)
))
const isTerminalStatus = computed(() => props.statusAction === 'home')
const isOpeningFeedback = computed(() => props.status === 'submitted')
const isFeedbackRecovery = computed(() => (
  props.statusAction === 'feedback' && !isOpeningFeedback.value
))
const isFormLocked = computed(() => (
  props.submitting
  || isTerminalStatus.value
  || isOpeningFeedback.value
  || isFeedbackRecovery.value
))
const primaryDisabled = computed(() => (
  props.submitting
  || isTerminalStatus.value
  || isOpeningFeedback.value
))
const showPrimaryLoading = computed(() => props.submitting || isOpeningFeedback.value)
const primaryLabel = computed(() => {
  if (isFeedbackRecovery.value) return '重新打开训练反馈'
  if (showPrimaryLoading.value) return '正在提交'
  if (props.status === 'error') return '重新提交反馈'
  return props.timing === 'PRE' ? '保存并开始训练' : '提交并查看反馈'
})
const statusLabel = computed(() => (
  props.status === 'saved-locally'
    ? '已保存在本机'
    : isOpeningFeedback.value || isFeedbackRecovery.value
      ? '已保存'
      : '暂未保存'
))

function handleFieldChange(field: RatingField, value: number) {
  if (isFormLocked.value) return
  form[field] = value
}

function handleSliderChange(field: RatingField, event: { detail?: { value?: number } }) {
  const value = Number(event.detail?.value)
  if (Number.isFinite(value)) handleFieldChange(field, value)
}

function handleSubmit() {
  if (primaryDisabled.value) return

  emit('submit', {
    feelingScale: form.feelingScale,
    feltArousalScale: form.feltArousalScale
  })
}
</script>

<template>
  <form
    class="short-questionnaire-form"
    :class="{ 'short-questionnaire-form--submitted': isOpeningFeedback }"
    @submit.prevent="handleSubmit"
  >
    <view class="short-questionnaire-form__intro">
      <text class="short-questionnaire-form__eyebrow">{{ props.timing === 'PRE' ? '运动前测量' : '训练已完成' }}</text>
      <text class="short-questionnaire-form__title">记录此刻感受</text>
      <text class="short-questionnaire-form__copy">两个问题，约 20 秒。请按此刻的真实感受选择；同一次运动前后各记录一次。</text>
    </view>

    <view
      v-for="section in questionSections"
      :key="section.field"
      class="short-questionnaire-form__question"
    >
      <view class="short-questionnaire-form__question-head">
        <view class="short-questionnaire-form__question-copy">
          <text class="short-questionnaire-form__question-index">{{ section.index }}</text>
          <view class="short-questionnaire-form__question-text">
            <text class="short-questionnaire-form__question-title">{{ section.title }}</text>
            <text class="short-questionnaire-form__question-hint">{{ section.hint }}</text>
          </view>
        </view>
      </view>

      <view class="short-questionnaire-form__scale-group">
        <view class="short-questionnaire-form__scale">
          <view class="short-questionnaire-form__ticks" aria-hidden="true">
            <view
              v-for="value in section.values"
              :key="value"
              class="short-questionnaire-form__tick"
              :class="{ 'short-questionnaire-form__tick--selected': form[section.field] === value }"
            >
              <text>{{ value }}</text>
              <view class="short-questionnaire-form__tick-mark" />
            </view>
          </view>
          <slider
            class="short-questionnaire-form__slider"
            :min="section.values[0]"
            :max="section.values[section.values.length - 1]"
            :step="1"
            :value="form[section.field]"
            :disabled="isFormLocked"
            active-color="#ff8b8b"
            background-color="#e8e0d7"
            block-color="#203042"
            :block-size="22"
            :aria-label="section.title"
            @changing="handleSliderChange(section.field, $event)"
            @change="handleSliderChange(section.field, $event)"
          />
        </view>
        <view class="short-questionnaire-form__scale-labels">
          <text>{{ section.lowLabel }}</text>
          <text>{{ section.highLabel }}</text>
        </view>
      </view>
    </view>

    <view
      v-if="hasPersistentStatusMessage"
      class="short-questionnaire-form__feedback-slot"
    >
      <view
        class="short-questionnaire-form__status"
        :class="`short-questionnaire-form__status--${props.status}`"
        aria-live="polite"
      >
        <text class="short-questionnaire-form__status-label">{{ statusLabel }}</text>
        <text class="short-questionnaire-form__status-copy">{{ props.statusMessage }}</text>
      </view>
    </view>

    <button
      v-if="isTerminalStatus"
      class="short-questionnaire-form__primary-action"
      type="button"
      hover-class="short-questionnaire-form__primary-action--pressed"
      @click="emit('goHome')"
    >
      <text>返回训练首页</text>
    </button>
    <button
      v-else-if="isFeedbackRecovery"
      class="short-questionnaire-form__primary-action"
      type="button"
      hover-class="short-questionnaire-form__primary-action--pressed"
      @click="emit('openFeedback')"
    >
      <text>{{ primaryLabel }}</text>
    </button>
    <button
      v-else
      class="short-questionnaire-form__primary-action"
      form-type="submit"
      :disabled="primaryDisabled"
      hover-class="short-questionnaire-form__primary-action--pressed"
    >
      <view class="short-questionnaire-form__primary-content">
        <text>{{ primaryLabel }}</text>
        <view
          v-if="showPrimaryLoading"
          class="short-questionnaire-form__primary-spinner"
          aria-hidden="true"
        >
          <uni-icons type="spinner-cycle" size="20" color="#fffaf4" />
        </view>
      </view>
    </button>
  </form>
</template>

<style scoped>
.short-questionnaire-form {
  --checkin-ink: #263442;
  --checkin-muted: #657284;
  --checkin-surface: #fffaf4;
  --checkin-subtle-surface: #f4ede4;
  --checkin-line: #ddd2c5;
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0;
  box-sizing: border-box;
  color: var(--checkin-ink);
}

.short-questionnaire-form__intro {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 34rpx 32rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.32);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
  margin-bottom: 32rpx;
}

.short-questionnaire-form__eyebrow {
  color: #8f5e4c;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.short-questionnaire-form__title {
  color: var(--checkin-ink);
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.short-questionnaire-form__copy {
  max-width: 560rpx;
  color: var(--checkin-muted);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.55;
}

.short-questionnaire-form__question {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  padding: 30rpx 32rpx 28rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.28);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
  margin-bottom: 32rpx;
}

.short-questionnaire-form__question-head {
  display: flex;
  min-width: 0;
  align-items: center;
}

.short-questionnaire-form__question-head {
  justify-content: space-between;
  gap: 20rpx;
}

.short-questionnaire-form__question-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 18rpx;
}

.short-questionnaire-form__question-index {
  flex: none;
  color: #8f5e4c;
  font-size: 34rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
}

.short-questionnaire-form__question-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5rpx;
}

.short-questionnaire-form__question-title {
  color: var(--checkin-ink);
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.3;
}

.short-questionnaire-form__question-hint {
  color: var(--checkin-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.4;
}

.short-questionnaire-form__scale-group {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.short-questionnaire-form__scale {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.short-questionnaire-form--submitted .short-questionnaire-form__scale {
  transform: scale(0.992);
}

.short-questionnaire-form__ticks {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 18rpx;
}

.short-questionnaire-form__tick {
  display: flex;
  min-width: 24rpx;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  color: #8a97a8;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1;
  transition: color 160ms ease, transform 160ms ease;
}

.short-questionnaire-form__tick--selected {
  color: #c76b5b;
  font-weight: 900;
  transform: translateY(-2rpx);
}

.short-questionnaire-form__tick-mark {
  width: 3rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: currentColor;
}

.short-questionnaire-form__slider {
  width: calc(100% - 56rpx);
  margin: -6rpx 28rpx 0;
}

.short-questionnaire-form__scale-labels {
  display: flex;
  justify-content: space-between;
  color: var(--checkin-muted);
  padding: 0 2rpx;
  font-size: 25rpx;
  font-weight: 800;
}

.short-questionnaire-form__primary-action::after {
  display: none;
}

.short-questionnaire-form__feedback-slot {
  min-height: 32rpx;
  padding: 20rpx 22rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.28);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.94);
  transition: background-color 220ms cubic-bezier(0.22, 1, 0.36, 1);
  margin-bottom: 32rpx;
}

.short-questionnaire-form__status {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 18rpx 20rpx;
  border: 2rpx solid #e4cec4;
  border-radius: 18rpx;
  background: #fbefeb;
}

.short-questionnaire-form__status--saved-locally {
  border-color: #c9ded4;
  background: #eaf3ee;
}

.short-questionnaire-form__status-label {
  color: #8a5146;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.25;
}

.short-questionnaire-form__status--saved-locally .short-questionnaire-form__status-label {
  color: #356654;
}

.short-questionnaire-form__status-copy {
  color: #5f5954;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.5;
}

.short-questionnaire-form__primary-action {
  display: inline-flex;
  width: 100%;
  min-height: 100rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 24rpx;
  border: 2rpx solid #ff7777;
  border-radius: 9999px;
  background: #ff7777;
  box-shadow: 0 8rpx 0 #de7272;
  box-sizing: border-box;
  color: #fffaf4;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 1.2;
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.short-questionnaire-form__primary-action--pressed {
  border-color: #e96565;
  background: #e96565;
  box-shadow: 0 4rpx 0 #c75f5f;
  transform: translateY(4rpx);
}

.short-questionnaire-form__primary-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
}

.short-questionnaire-form__primary-spinner {
  display: inline-flex;
  width: 40rpx;
  height: 40rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  animation: short-questionnaire-form-spin 900ms linear infinite;
}

.short-questionnaire-form__primary-action[disabled] {
  border-color: #ff7777;
  background: #ff7777;
  box-shadow: 0 8rpx 0 #de7272;
  color: #fffaf4;
  opacity: 1;
}

@keyframes short-questionnaire-form-spin {
  to { transform: rotate(360deg); }
}

@media (max-height: 640px) {
  .short-questionnaire-form__intro {
    padding-top: 32rpx;
  }

  .short-questionnaire-form__question {
    gap: 20rpx;
    padding-top: 24rpx;
    padding-bottom: 24rpx;
  }
}
</style>
