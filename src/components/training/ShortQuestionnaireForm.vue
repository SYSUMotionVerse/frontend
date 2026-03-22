<script setup lang="ts">
import { reactive, computed } from 'vue'
import {
  getRatingOptionClasses,
  type RatingOptionPalette
} from '../../features/questionnaire/ratingOptionStyles'

const emit = defineEmits<{
  submit: [payload: { energyLevel: number; confidence: number; enjoyment: number }]
}>()

const form = reactive({
  energyLevel: 0,
  confidence: 0,
  enjoyment: 0
})

const isComplete = computed(() => {
  return form.energyLevel > 0 && form.confidence > 0 && form.enjoyment > 0
})

function handleFieldChange(field: keyof typeof form, value: number) {
  form[field] = value
}

function optionClasses(isSelected: boolean, palette: RatingOptionPalette) {
  return getRatingOptionClasses(isSelected, palette)
}
</script>

<template>
  <form
    class="flex flex-col gap-8"
    @submit.prevent="emit('submit', { ...form })"
  >
    <div class="bg-white p-8 rounded-[36px] shadow-sm border border-[#F0E6D8] text-center mb-2">
      <div class="inline-flex items-center justify-center p-4 rounded-full bg-[#E0EDFF] text-[#4A90E2] mb-4 border-[4px] border-[#D1E8FF]">
        <text class="text-[72rpx]">🙂</text>
      </div>
      <p class="text-[56rpx] font-black tracking-tight text-[#1A202C]">Post-session check-in</p>
      <p class="mt-2 text-[40rpx] font-bold text-[#64748B]">
        Capture how the session felt before feedback appears.
      </p>
    </div>

    <!-- Energy Level -->
    <article class="bg-white rounded-[32px] p-8 shadow-sm border border-[#F0E6D8]">
      <p class="text-[48rpx] font-black text-[#1A202C] leading-snug mb-6 tracking-tight flex items-center gap-2">
        <text class="text-[#FFD384]">⚡</text> Energy Level
      </p>
      <div class="flex items-center justify-between gap-2">
        <label v-for="val in 5" :key="val" class="relative cursor-pointer group flex-1 flex justify-center">
          <input
            class="sr-only"
            type="radio"
            :checked="form.energyLevel === val"
            @change="handleFieldChange('energyLevel', val)"
          />
          <div class="rating-option rating-option--rounded" :class="optionClasses(form.energyLevel === val, 'gold')">
            {{ val }}
          </div>
        </label>
      </div>
    </article>

    <!-- Confidence -->
    <article class="bg-white rounded-[32px] p-8 shadow-sm border border-[#F0E6D8]">
      <p class="text-[48rpx] font-black text-[#1A202C] leading-snug mb-6 tracking-tight flex items-center gap-2">
        <text class="text-[#4A90E2]">✔️</text> Movement Confidence
      </p>
      <div class="flex items-center justify-between gap-2">
        <label v-for="val in 5" :key="val" class="relative cursor-pointer group flex-1 flex justify-center">
          <input
            class="sr-only"
            type="radio"
            :checked="form.confidence === val"
            @change="handleFieldChange('confidence', val)"
          />
          <div class="rating-option rating-option--rounded" :class="optionClasses(form.confidence === val, 'blue')">
            {{ val }}
          </div>
        </label>
      </div>
    </article>

    <!-- Enjoyment -->
    <article class="bg-white rounded-[32px] p-8 shadow-sm border border-[#F0E6D8]">
      <p class="text-[48rpx] font-black text-[#1A202C] leading-snug mb-6 tracking-tight flex items-center gap-2">
        <text class="text-[#FF6B6B]">❤️</text> Enjoyment
      </p>
      <div class="flex items-center justify-between gap-2">
        <label v-for="val in 5" :key="val" class="relative cursor-pointer group flex-1 flex justify-center">
          <input
            class="sr-only"
            type="radio"
            :checked="form.enjoyment === val"
            @change="handleFieldChange('enjoyment', val)"
          />
          <div class="rating-option rating-option--rounded" :class="optionClasses(form.enjoyment === val, 'coral')">
            {{ val }}
          </div>
        </label>
      </div>
    </article>

    <div class="mt-4 pb-12">
      <button class="btn-primary" form-type="submit" :disabled="!isComplete">
        <text v-if="!isComplete">Incomplete</text>
        <text v-else>Continue ✨</text>
      </button>
    </div>
  </form>
</template>

<style scoped>
@import '../../features/questionnaire/ratingOptionStyles.css';
</style>
