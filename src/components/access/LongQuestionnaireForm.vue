<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import type {
  PsychologyQuestionnaireAnswer,
  PsychologyQuestionnaireModel
} from '../../uni-app/api/studentBackendTypes'
import QuestionnaireBottomNavigation from './QuestionnaireBottomNavigation.vue'
import QuestionnaireInstructionsCard from './QuestionnaireInstructionsCard.vue'
import QuestionnaireProgressHeader from './QuestionnaireProgressHeader.vue'
import QuestionnaireQuestionPanel from './QuestionnaireQuestionPanel.vue'

interface SubmissionPayload {
  scaleId: number
  answers: Record<number, PsychologyQuestionnaireAnswer>
  title: string
}

interface DraftPayload {
  answers: Record<number, PsychologyQuestionnaireAnswer>
  currentQuestionIndex: number
}

const props = withDefaults(defineProps<{
  questionnaire: PsychologyQuestionnaireModel
  submitting?: boolean
  submitLabel?: string
  initialAnswers?: Record<number, PsychologyQuestionnaireAnswer>
  initialQuestionIndex?: number
  questionnaireCount?: number
  questionnaireNumber?: number
  completedQuestionCountBefore?: number
  totalQuestionCount?: number
  estimatedMinutes?: number
}>(), {
  submitting: false,
  submitLabel: '提交答案',
  initialAnswers: () => ({}),
  initialQuestionIndex: 0,
  questionnaireCount: 1,
  questionnaireNumber: 1,
  completedQuestionCountBefore: 0
})

const emit = defineEmits<{
  submit: [payload: SubmissionPayload]
  draftChange: [payload: DraftPayload]
  reload: []
}>()

const answers = reactive<Record<number, PsychologyQuestionnaireAnswer>>({})
const validationMessage = shallowRef('')

function initializeAnswers(
  questionnaire: PsychologyQuestionnaireModel,
  initialAnswers: Record<number, PsychologyQuestionnaireAnswer>
) {
  for (const questionId of Object.keys(answers)) {
    delete answers[Number(questionId)]
  }

  for (const question of questionnaire.questions) {
    const restoredAnswer = initialAnswers[question.id]
    if (question.questionType === 'TEXT') {
      answers[question.id] = typeof restoredAnswer === 'string' ? restoredAnswer : ''
      continue
    }

    if (question.questionType === 'MULTIPLE') {
      answers[question.id] = Array.isArray(restoredAnswer)
        ? restoredAnswer.filter(optionId => question.options.some(option => option.id === optionId))
        : []
      continue
    }

    answers[question.id] = question.options.some(option => option.id === restoredAnswer)
      ? restoredAnswer
      : 0
  }
}

initializeAnswers(props.questionnaire, props.initialAnswers)

function responseConfigValue(question: PsychologyQuestionnaireModel['questions'][number], key: string) {
  return question.responseConfig?.[key]
}

const visibleQuestions = computed(() => {
  const visible = []
  let skipUntil = 0
  for (const question of props.questionnaire.questions) {
    const sourceOrder = question.sourceOrder ?? question.id
    if (skipUntil && sourceOrder < skipUntil) continue
    if (skipUntil && sourceOrder >= skipUntil) skipUntil = 0
    visible.push(question)

    const skipTarget = responseConfigValue(question, 'skip_to_on_no')
    const answer = answers[question.id]
    if (typeof skipTarget !== 'string' || typeof answer !== 'number' || answer <= 0) continue
    const selected = question.options.find(option => option.id === answer)
    if (selected?.score === 0) {
      skipUntil = Number(skipTarget.replace(/^P/, '')) || 0
    }
  }
  return visible
})

const questionCount = computed(() => visibleQuestions.value.length)
function clampQuestionIndex(index: number) {
  return Math.min(
    Math.max(0, index),
    Math.max(0, questionCount.value - 1)
  )
}

const currentQuestionIndex = shallowRef(clampQuestionIndex(props.initialQuestionIndex))
const currentQuestion = computed(() =>
  visibleQuestions.value[currentQuestionIndex.value] ?? null
)
const currentAnswer = computed(() =>
  currentQuestion.value ? answers[currentQuestion.value.id] : ''
)
const currentQuestionNumber = computed(() => currentQuestionIndex.value + 1)
const resolvedEstimatedMinutes = computed(() =>
  props.estimatedMinutes ?? Math.max(3, Math.ceil((questionCount.value * 8) / 60))
)
const totalQuestionCount = computed(() =>
  props.totalQuestionCount ?? questionCount.value
)
const completedQuestionCount = computed(() => Math.min(
  totalQuestionCount.value,
  props.completedQuestionCountBefore + visibleQuestions.value.filter(
    question => hasAnswer(answers[question.id])
  ).length
))
const overallProgressPercent = computed(() => {
  if (!totalQuestionCount.value) return 0
  return Math.round((completedQuestionCount.value / totalQuestionCount.value) * 100)
})
const isFirstQuestion = computed(() => currentQuestionIndex.value === 0)
const isLastQuestion = computed(() =>
  currentQuestionIndex.value === questionCount.value - 1
)
const legendItems = computed(() => {
  if (props.questionnaire.responseLegend?.length) {
    return props.questionnaire.responseLegend.map(item => ({
      key: String(item.value),
      label: item.label
    }))
  }

  const question = currentQuestion.value
  if (!question || question.questionType === 'TEXT' || question.options.length > 7) {
    return []
  }

  const scores = question.options.map(option => option.score)
  const usesNumericLegend = scores.length > 0
    && new Set(scores).size === scores.length
    && [...scores].sort((left, right) => left - right).every(
      (score, index) => score === index + 1
    )

  return question.options.map((option, index) => ({
    key: usesNumericLegend ? String(option.score) : String.fromCharCode(65 + index),
    label: option.label
  }))
})
const instructionsCopy = computed(() =>
  props.questionnaire.instructions?.trim()
    || props.questionnaire.description?.trim()
    || '请结合自己的真实情况选择最符合的答案。'
)

watch(() => props.questionnaire, (nextQuestionnaire) => {
  // uni-app may reuse the Vue child instance even when the surrounding view's
  // key changes. Reset the runner explicitly so every new questionnaire owns
  // its own local question index and answers.
  currentQuestionIndex.value = 0
  initializeAnswers(nextQuestionnaire, props.initialAnswers)
  currentQuestionIndex.value = clampQuestionIndex(props.initialQuestionIndex)
  validationMessage.value = ''
}, { flush: 'pre' })

function hasAnswer(answer: PsychologyQuestionnaireAnswer | undefined) {
  if (Array.isArray(answer)) return answer.length > 0
  return typeof answer === 'number' ? answer > 0 : Boolean(answer?.trim())
}

function emitDraft() {
  emit('draftChange', {
    answers: { ...answers },
    currentQuestionIndex: currentQuestionIndex.value
  })
}

watch(questionCount, () => {
  const nextQuestionIndex = clampQuestionIndex(currentQuestionIndex.value)
  if (nextQuestionIndex === currentQuestionIndex.value) return

  currentQuestionIndex.value = nextQuestionIndex
  validationMessage.value = ''
  emitDraft()
}, { flush: 'sync' })

function handleResponseChange(questionId: number, optionId: number) {
  const question = props.questionnaire.questions.find(item => item.id === questionId)
  if (question?.questionType === 'MULTIPLE') {
    const selected = Array.isArray(answers[questionId]) ? [...answers[questionId]] : []
    const optionIndex = selected.indexOf(optionId)
    if (optionIndex >= 0) {
      selected.splice(optionIndex, 1)
    } else {
      selected.push(optionId)
    }
    answers[questionId] = selected
  } else {
    answers[questionId] = optionId
  }
  validationMessage.value = ''
  emitDraft()
}

function handleIntegerInput(value: string) {
  if (!currentQuestion.value) return
  answers[currentQuestion.value.id] = value.trim()
  validationMessage.value = ''
  emitDraft()
}

function handleDurationInput(field: 'hours' | 'minutes', value: string) {
  if (!currentQuestion.value) return
  const existingAnswer = currentAnswer.value
  let existing = { hours: '', minutes: '' }
  if (typeof existingAnswer === 'string' && existingAnswer.startsWith('{')) {
    try {
      const parsed = JSON.parse(existingAnswer) as { hours?: number; minutes?: number }
      existing = {
        hours: parsed.hours === undefined ? '' : String(parsed.hours),
        minutes: parsed.minutes === undefined ? '' : String(parsed.minutes)
      }
    } catch {
      existing = { hours: '', minutes: '' }
    }
  }
  const next = { ...existing, [field]: value.trim() }
  answers[currentQuestion.value.id] = next.hours || next.minutes
    ? JSON.stringify({
        hours: Number(next.hours || 0),
        minutes: Number(next.minutes || 0)
      })
    : ''
  validationMessage.value = ''
  emitDraft()
}

function showPreviousQuestion() {
  if (isFirstQuestion.value) return
  currentQuestionIndex.value -= 1
  validationMessage.value = ''
  emitDraft()
}

function showNextQuestion() {
  if (!hasAnswer(currentAnswer.value)) {
    validationMessage.value = '请先完成本题。'
    return
  }
  if (isLastQuestion.value) return
  currentQuestionIndex.value += 1
  validationMessage.value = ''
  emitDraft()
}

function handleSubmit() {
  if (props.submitting) return

  const firstUnansweredIndex = visibleQuestions.value.findIndex(
    question => !hasAnswer(answers[question.id])
  )
  if (firstUnansweredIndex >= 0) {
    currentQuestionIndex.value = firstUnansweredIndex
    validationMessage.value = '还有未完成的题目，已为你定位到第一道未答题。'
    emitDraft()
    return
  }

  emit('submit', {
    scaleId: props.questionnaire.scaleId,
    answers: Object.fromEntries(
      visibleQuestions.value.map(question => [question.id, answers[question.id]])
    ),
    title: props.questionnaire.title
  })
}
</script>

<template>
  <view class="questionnaire-runner">
    <view class="questionnaire-runner__block">
      <QuestionnaireProgressHeader
        :questionnaire-title="questionnaire.shortTitle || questionnaire.title"
        :questionnaire-count="questionnaireCount"
        :questionnaire-number="questionnaireNumber"
        :completed-question-count="completedQuestionCount"
        :total-question-count="totalQuestionCount"
        :estimated-minutes="resolvedEstimatedMinutes"
        :progress-percent="overallProgressPercent"
      />
    </view>

    <view class="questionnaire-runner__block questionnaire-runner__block--spaced">
      <QuestionnaireInstructionsCard
        :instructions="instructionsCopy"
        :legend-items="legendItems"
      />
    </view>

    <view class="questionnaire-runner__block questionnaire-runner__block--spaced">
      <QuestionnaireQuestionPanel
        v-if="currentQuestion"
        :question="currentQuestion"
        :answer="currentAnswer"
        :question-number="currentQuestionNumber"
        :question-count="questionCount"
        @select="handleResponseChange"
        @integer-input="handleIntegerInput"
        @duration-input="handleDurationInput"
      />
      <view v-else class="questionnaire-runner__empty-state" aria-live="polite">
        <text class="questionnaire-runner__empty-title">这份问卷暂时没有可作答的题目。</text>
        <text>请重新加载问卷；若仍无法继续，请联系研究管理员。</text>
        <button
          class="questionnaire-runner__empty-retry"
          type="button"
          @click="emit('reload')"
        >
          重新加载问卷
        </button>
      </view>
    </view>

    <text
      v-if="validationMessage"
      class="questionnaire-runner__validation"
      aria-live="polite"
    >
      {{ validationMessage }}
    </text>

    <view class="questionnaire-runner__block questionnaire-runner__block--spaced">
      <QuestionnaireBottomNavigation
        :can-continue="hasAnswer(currentAnswer)"
        :can-go-back="!isFirstQuestion"
        :last-question="isLastQuestion"
        :submitting="submitting"
        :submit-label="submitLabel"
        @previous="showPreviousQuestion"
        @next="showNextQuestion"
        @submit="handleSubmit"
      />
    </view>
  </view>
</template>

<style scoped>
.questionnaire-runner {
  display: flex;
  flex-direction: column;
  min-height: 70vh;
}

.questionnaire-runner__block {
  display: block;
  width: 100%;
}

.questionnaire-runner__block--spaced {
  margin-top: 32rpx;
}

.questionnaire-runner__validation {
  display: block;
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border: 4rpx solid rgba(255, 139, 139, 0.36);
  border-radius: 20rpx;
  background: rgba(255, 139, 139, 0.12);
  color: #9F3041;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.45;
}

.questionnaire-runner__empty-state {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 30rpx;
  border: 4rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 28rpx;
  background: #FFFCF8;
  color: #64748B;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.55;
}

.questionnaire-runner__empty-title {
  color: #1A202C;
  font-size: 28rpx;
  font-weight: 900;
}

.questionnaire-runner__empty-retry {
  min-height: 88rpx;
  margin: 8rpx 0 0;
  border: 0;
  border-radius: 999rpx;
  background: #FF8B8B;
  box-shadow: 0 6rpx 0 #DE7272;
  color: #1A202C;
  font-size: 28rpx;
  font-weight: 900;
}

.questionnaire-runner__empty-retry::after {
  border: none;
}
</style>
