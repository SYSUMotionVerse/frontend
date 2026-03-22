<script setup lang="ts">
import { computed } from 'vue'
import type { CheckpointKey } from '../../types/student'
import { CHECKPOINT_LABELS } from '../../features/access/questionnaire'

interface Props {
  checkpoint: CheckpointKey
  score: number
  percentage: number
  submittedAt?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  continue: []
}>()

const level = computed(() => {
  if (props.percentage >= 85) {
    return 'Excellent momentum'
  }

  if (props.percentage >= 65) {
    return 'Good progress'
  }

  return 'Needs reinforcement'
})

const checkpointLabel = computed(() => CHECKPOINT_LABELS[props.checkpoint])
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
  <section class="rounded-12 border border-slate-200 bg-white p-24">
    <p class="text-[40rpx] font-700 text-slate-500">{{ checkpointLabel }} assessment</p>
    <h2 class="mt-10 text-[96rpx] font-800 text-brand-ink">{{ percentage }}%</h2>
    <p class="mt-8 text-[48rpx] text-slate-700">Score: {{ score }}</p>
    <p class="mt-8 text-[56rpx] font-700 text-brand-ink">{{ level }}</p>
    <p v-if="submittedAtLabel" class="mt-12 text-[40rpx] text-slate-500">
      Submitted: {{ submittedAtLabel }}
    </p>
    <view
      class="btn-primary mt-20 result-card__cta"
      role="button"
      tabindex="0"
      @click="handleContinue"
      @keydown.enter.prevent="handleContinue"
      @keydown.space.prevent="handleContinue"
    >
      Continue to Home
    </view>
  </section>
</template>

<style scoped>
.result-card__cta {
  min-height: 4.25rem;
  white-space: nowrap;
}
</style>
