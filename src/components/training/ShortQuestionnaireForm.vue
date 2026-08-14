<script setup lang="ts">
import { computed, reactive } from 'vue'

type RatingField = 'energyLevel' | 'confidence' | 'enjoyment'
type SubmissionStatus = 'idle' | 'error' | 'saved-locally' | 'submitted'
type StatusAction = 'retry' | 'home' | 'feedback'

const emit = defineEmits<{
  submit: [payload: { energyLevel: number; confidence: number; enjoyment: number }]
  openFeedback: []
  goHome: []
}>()

const props = withDefaults(defineProps<{
  submitting?: boolean
  status?: SubmissionStatus
  statusMessage?: string
  statusAction?: StatusAction
}>(), {
  submitting: false,
  status: 'idle',
  statusMessage: '',
  statusAction: 'retry'
})

const form = reactive({
  energyLevel: 0,
  confidence: 0,
  enjoyment: 0
})

const questionSections: Array<{
  field: RatingField
  index: string
  title: string
  hint: string
}> = [
  {
    field: 'energyLevel',
    index: '01',
    title: '精力水平',
    hint: '此刻的身体状态'
  },
  {
    field: 'confidence',
    index: '02',
    title: '运动信心',
    hint: '下次训练时的把握'
  },
  {
    field: 'enjoyment',
    index: '03',
    title: '乐趣感受',
    hint: '这次训练是否自在'
  }
]

const completedCount = computed(() => (
  questionSections.filter(section => form[section.field] > 0).length
))
const isComplete = computed(() => completedCount.value === questionSections.length)
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
  !isComplete.value
  || props.submitting
  || isTerminalStatus.value
  || isOpeningFeedback.value
))
const completionLabel = computed(() => `已完成 ${completedCount.value}/3 项`)
const primaryLabel = computed(() => {
  if (isOpeningFeedback.value) return '正在打开训练反馈…'
  if (isFeedbackRecovery.value) return '重新打开训练反馈'
  if (props.submitting) return '正在保存反馈…'
  if (props.status === 'error') return '重新提交反馈'
  if (!isComplete.value) return `完成 ${completedCount.value}/3 项后提交`
  return '提交并查看反馈'
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

function scoreLabel(field: RatingField) {
  return form[field] ? `已选 ${form[field]} 分` : '未选择'
}

function handleSubmit() {
  if (primaryDisabled.value) return

  emit('submit', { ...form })
}
</script>

<template>
  <form
    class="short-questionnaire-form"
    :class="{ 'short-questionnaire-form--submitted': isOpeningFeedback }"
    @submit.prevent="handleSubmit"
  >
    <view class="short-questionnaire-form__intro">
      <text class="short-questionnaire-form__eyebrow">训练已完成</text>
      <text class="short-questionnaire-form__title">记录这次感受</text>
      <text class="short-questionnaire-form__copy">三个问题，约 20 秒。1 分较低，5 分较高。</text>
    </view>

    <view class="short-questionnaire-form__questions">
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
          <text class="short-questionnaire-form__question-score">{{ scoreLabel(section.field) }}</text>
        </view>

        <view class="short-questionnaire-form__scores" role="radiogroup" :aria-label="section.title">
          <button
            v-for="value in 5"
            :key="value"
            class="short-questionnaire-form__score"
            :class="{ 'short-questionnaire-form__score--selected': form[section.field] === value }"
            type="button"
            :disabled="isFormLocked"
            :aria-label="`${section.title} ${value} 分`"
            :aria-checked="form[section.field] === value"
            role="radio"
            hover-class="short-questionnaire-form__score--pressed"
            @click="handleFieldChange(section.field, value)"
          >
            <text>{{ value }}</text>
          </button>
        </view>
      </view>
    </view>

    <view
      class="short-questionnaire-form__actions"
      :class="{ 'short-questionnaire-form__actions--submitted': isOpeningFeedback }"
    >
      <view class="short-questionnaire-form__feedback-slot">
        <text
          v-if="isOpeningFeedback"
          class="short-questionnaire-form__handoff"
          aria-live="polite"
        >
          {{ props.statusMessage || '反馈已保存，正在打开训练反馈…' }}
        </text>
        <view
          v-else-if="hasPersistentStatusMessage"
          class="short-questionnaire-form__status"
          :class="`short-questionnaire-form__status--${props.status}`"
          aria-live="polite"
        >
          <text class="short-questionnaire-form__status-label">{{ statusLabel }}</text>
          <text class="short-questionnaire-form__status-copy">{{ props.statusMessage }}</text>
        </view>

        <text v-else class="short-questionnaire-form__completion">{{ completionLabel }}</text>
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
        <text>{{ primaryLabel }}</text>
      </button>
    </view>
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
  overflow: hidden;
  border: 2rpx solid var(--checkin-line);
  border-radius: 28rpx;
  background: var(--checkin-surface);
  box-sizing: border-box;
  color: var(--checkin-ink);
}

.short-questionnaire-form__intro {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 40rpx 36rpx 32rpx;
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

.short-questionnaire-form__questions {
  display: flex;
  flex-direction: column;
  border-top: 2rpx solid var(--checkin-line);
}

.short-questionnaire-form__question {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 30rpx 36rpx;
}

.short-questionnaire-form__question + .short-questionnaire-form__question {
  border-top: 2rpx solid var(--checkin-line);
}

.short-questionnaire-form__question-head,
.short-questionnaire-form__question-copy {
  display: flex;
  min-width: 0;
  align-items: flex-start;
}

.short-questionnaire-form__question-head {
  justify-content: space-between;
  gap: 20rpx;
}

.short-questionnaire-form__question-copy {
  flex: 1;
  gap: 16rpx;
}

.short-questionnaire-form__question-index {
  padding-top: 3rpx;
  color: #8f5e4c;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.25;
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

.short-questionnaire-form__question-hint,
.short-questionnaire-form__question-score {
  color: var(--checkin-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.4;
}

.short-questionnaire-form__question-score {
  flex: none;
  padding-top: 4rpx;
  color: #4f6670;
  text-align: right;
  white-space: nowrap;
}

.short-questionnaire-form__scores {
  display: flex;
  gap: 12rpx;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.short-questionnaire-form--submitted .short-questionnaire-form__scores {
  transform: scale(0.992);
}

.short-questionnaire-form__score {
  display: inline-flex;
  min-width: 0;
  min-height: 88rpx;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 2rpx solid #d9cec1;
  border-radius: 18rpx;
  background: var(--checkin-subtle-surface);
  box-sizing: border-box;
  color: #4c5c68;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 1;
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.short-questionnaire-form__score::after,
.short-questionnaire-form__primary-action::after {
  display: none;
}

.short-questionnaire-form__score--selected {
  border-color: var(--checkin-ink);
  background: var(--checkin-ink);
  color: #fffaf4;
}

.short-questionnaire-form__score--pressed {
  background: #eae0d4;
}

.short-questionnaire-form__score--selected.short-questionnaire-form__score--pressed {
  background: #1e2a36;
}

.short-questionnaire-form__score[disabled] {
  opacity: 0.56;
}

.short-questionnaire-form__actions {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 28rpx 36rpx calc(36rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid var(--checkin-line);
  background: #f8f1e9;
  transition: background-color 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.short-questionnaire-form__actions--submitted {
  background: #edf5ef;
}

.short-questionnaire-form__feedback-slot {
  min-height: 32rpx;
}

.short-questionnaire-form__completion {
  display: block;
  color: var(--checkin-muted);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.35;
}

.short-questionnaire-form__handoff {
  display: block;
  color: #286743;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.35;
  animation: short-questionnaire-form__handoff-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
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
  border: 2rpx solid var(--checkin-ink);
  border-radius: 9999px;
  background: var(--checkin-ink);
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
  background: #1e2a36;
}

.short-questionnaire-form__primary-action[disabled] {
  border-color: #90999f;
  background: #90999f;
  color: #f7f2ea;
}

.short-questionnaire-form__actions--submitted .short-questionnaire-form__primary-action[disabled] {
  border-color: #47755e;
  background: #47755e;
  color: #fffaf4;
}

@keyframes short-questionnaire-form__handoff-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 10rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
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

  .short-questionnaire-form__score {
    min-height: 80rpx;
  }
}
</style>
