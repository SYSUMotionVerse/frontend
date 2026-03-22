<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { CheckpointKey } from '../../types/student'
import { evaluateLongQuestionnaire, type LongQuestion } from '../../features/access/questionnaire'
import { getRatingOptionClasses } from '../../features/questionnaire/ratingOptionStyles'

interface Props {
  checkpoint: CheckpointKey
  questions: LongQuestion[]
}

interface SubmissionPayload {
  responses: Record<string, number>
  score: number
  percentage: number
  submittedAt: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  submit: [payload: SubmissionPayload]
}>()

const responses = reactive<Record<string, number>>({})

for (const question of props.questions) {
  responses[question.id] = 0
}

const isComplete = computed(() => Object.values(responses).every((value) => value > 0))

function handleSubmit() {
  if (!isComplete.value) {
    return
  }

  const result = evaluateLongQuestionnaire(props.checkpoint, { ...responses })
  emit('submit', {
    responses: result.responses,
    score: result.score,
    percentage: result.percentage,
    submittedAt: result.submittedAt
  })
}

function handleResponseChange(questionId: string, value: number) {
  responses[questionId] = value
}

function optionClasses(isSelected: boolean) {
  return getRatingOptionClasses(isSelected, 'gold')
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
    <article
      v-for="question in questions"
      :key="question.id"
      class="bg-white rounded-[32px] p-8 shadow-sm border border-[#F0E6D8]"
    >
      <p class="text-[48rpx] font-black text-[#1A202C] leading-snug mb-8 tracking-tight">{{ question.prompt }}</p>
      
      <div class="flex items-center justify-between gap-2">
        <label v-for="value in 5" :key="value" 
          class="relative flex flex-col items-center gap-2 cursor-pointer group flex-1"
        >
          <input
            class="sr-only"
            type="radio"
            :name="question.id"
            :checked="responses[question.id] === value"
            @change="handleResponseChange(question.id, value)"
          />
          <div class="rating-option rating-option--circle mx-auto" :class="optionClasses(responses[question.id] === value)">
            {{ value }}
          </div>
        </label>
      </div>
    </article>

    <div class="mt-8 pb-12">
      <button form-type="submit" class="btn-primary" :disabled="!isComplete">
        <text v-if="!isComplete">Complete all questions First</text>
        <text v-else>Submit Answers ✨</text>
      </button>
    </div>
  </form>
</template>

<style scoped>
@import '../../features/questionnaire/ratingOptionStyles.css';
</style>
