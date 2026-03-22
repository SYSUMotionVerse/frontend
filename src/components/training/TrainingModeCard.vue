<script setup lang="ts">
import type { TrainingModality } from '../../types/student'

const props = defineProps<{
  modality: TrainingModality
  title: string
  description: string
  accentClass: string
}>()

const emit = defineEmits<{
  choose: [modality: TrainingModality]
}>()

function handleChoose() {
  emit('choose', props.modality)
}
</script>

<template>
  <view
    class="training-mode-card card-shell w-full cursor-pointer p-24 text-left transition hover:-translate-y-2"
    role="button"
    tabindex="0"
    @click="handleChoose"
    @keydown.enter.prevent="handleChoose"
    @keydown.space.prevent="handleChoose"
  >
    <text class="chip-soft training-mode-card__chip" :class="props.accentClass">{{ props.title }}</text>
    <p class="mt-18 text-20 font-700 text-brand-ink">{{ props.title }}</p>
    <p class="mt-12 text-17 leading-7 text-slate-600">{{ props.description }}</p>
  </view>
</template>

<style scoped>
.training-mode-card {
  display: flex;
  min-height: 10rem;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}

.training-mode-card__chip {
  align-self: flex-start;
}
</style>
