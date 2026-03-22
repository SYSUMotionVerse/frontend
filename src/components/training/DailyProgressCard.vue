<script setup lang="ts">
const props = defineProps<{
  validCheckIns: number
  qualifyingDays: number
  reminderEligible: boolean
}>()

const progressSegments = [1, 2, 3]
</script>

<template>
  <section class="card-shell p-20">
    <div class="flex items-center justify-between gap-12">
      <div>
        <p class="section-title">Today&apos;s energy loop</p>
        <p class="mt-10 text-[44rpx] leading-8 text-slate-600">
          Complete up to three valid check-ins today to lock in your streak.
        </p>
      </div>

      <div class="rounded-full bg-brand-coral/12 px-16 py-10 text-[40rpx] font-700 text-brand-coral">
        {{ props.validCheckIns }}/3
      </div>
    </div>

    <div class="mt-18 grid grid-cols-3 gap-10">
      <div
        v-for="segment in progressSegments"
        :key="segment"
        class="h-16 rounded-full transition"
        :class="segment <= props.validCheckIns ? 'bg-brand-teal' : 'bg-slate-200'"
      />
    </div>

    <div class="mt-18 flex flex-wrap items-center gap-12 text-[36rpx] text-slate-600">
      <text class="chip-soft bg-brand-teal/15 text-brand-ink">
        Weekly qualifying days: {{ props.qualifyingDays }}
      </text>
      <text
        class="chip-soft"
        :class="props.reminderEligible ? 'bg-brand-gold/20 text-brand-ink' : 'bg-slate-100 text-slate-500'"
      >
        {{ props.reminderEligible ? '18:00 reminder still active' : 'Daily target completed' }}
      </text>
    </div>
  </section>
</template>
