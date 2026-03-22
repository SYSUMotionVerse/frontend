<script setup lang="ts">
defineProps<{
  title: string
  coachLabel: string
  learnerLabel: string
}>()

const emit = defineEmits<{
  complete: []
  interrupt: []
}>()
</script>

<template>
  <section class="card-shell p-20">
    <div class="flex items-center justify-between gap-12">
      <div>
        <p class="section-title">{{ title }}</p>
        <p class="mt-8 text-14 text-slate-600">
          Split-screen guidance mirrors the Mini Program camera flow.
        </p>
      </div>
      <text class="chip-soft bg-brand-coral/16 text-brand-coral">AI overlay placeholder</text>
    </div>

    <div class="mt-20 grid grid-cols-[1.2fr_0.9fr] gap-14">
      <div class="rounded-24 bg-brand-ink p-18 text-white">
        <p class="text-12 uppercase tracking-[0.18em] text-white/60">{{ coachLabel }}</p>
        <div class="mt-14 h-220 rounded-20 bg-white/10" />
      </div>
      <div class="rounded-24 bg-white p-18 ring-1 ring-slate-100">
        <p class="text-12 uppercase tracking-[0.18em] text-slate-500">{{ learnerLabel }}</p>
        <div class="mt-14 h-220 rounded-20 bg-brand-teal/15" />
      </div>
    </div>

    <div class="mt-20 flex gap-12">
      <button
        class="flex-1 rounded-full border-none bg-brand-teal px-16 py-14 text-15 font-700 text-brand-ink"
        type="button"
        @click="emit('complete')"
      >
        Finish guided session
      </button>
      <button
        class="rounded-full border-none bg-slate-100 px-16 py-14 text-15 font-600 text-slate-600"
        type="button"
        @click="emit('interrupt')"
      >
        Exit early
      </button>
    </div>
  </section>
</template>
