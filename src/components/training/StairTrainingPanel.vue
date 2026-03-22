<script setup lang="ts">
defineProps<{
  secondsLeft: number
}>()

const emit = defineEmits<{
  start: []
  complete: []
  interrupt: []
}>()
</script>

<template>
  <section class="card-shell p-20">
    <div class="flex items-center justify-between gap-12">
      <div>
        <p class="section-title">Stair-climb burst</p>
        <p class="mt-8 text-14 text-slate-600">
          30-second sensor capture with motion-only placeholders.
        </p>
      </div>
      <text class="chip-soft bg-brand-teal/16 text-brand-ink">Sensor status ready</text>
    </div>

    <div class="mt-22 flex justify-center">
      <div class="flex h-180 w-180 items-center justify-center rounded-full bg-brand-ink text-center text-white shadow-[0_16px_40px_rgba(34,48,74,0.18)]">
        <div>
          <p class="text-12 uppercase tracking-[0.18em] text-white/65">Seconds left</p>
          <p class="mt-12 text-54 font-800">{{ secondsLeft }}</p>
        </div>
      </div>
    </div>

    <div class="mt-20 flex gap-12">
      <button
        class="flex-1 rounded-full border-none bg-brand-gold px-16 py-14 text-15 font-700 text-brand-ink"
        type="button"
        @click="emit('start')"
      >
        Start 30-second timer
      </button>
      <button
        class="rounded-full border-none bg-brand-teal px-16 py-14 text-15 font-700 text-brand-ink"
        type="button"
        @click="emit('complete')"
      >
        Mark complete
      </button>
      <button
        class="rounded-full border-none bg-slate-100 px-16 py-14 text-15 font-600 text-slate-600"
        type="button"
        @click="emit('interrupt')"
      >
        Exit
      </button>
    </div>
  </section>
</template>
