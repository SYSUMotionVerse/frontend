<script setup lang="ts">
defineProps<{
  modalityLabel: string
  qualityScore: number
  summary: string
}>()
</script>

<template>
  <section class="card-shell p-22">
    <p class="chip-soft bg-brand-teal/16 text-brand-ink">Session completed</p>
    <h1 class="mt-16 text-28 font-800 text-brand-ink">{{ modalityLabel }} feedback</h1>
    <p class="mt-10 text-14 leading-6 text-slate-600">
      Completion is locked in. Quality feedback helps refine the next round.
    </p>

    <div class="mt-22 grid grid-cols-2 gap-14">
      <div class="rounded-20 bg-brand-ink p-18 text-white">
        <p class="text-12 uppercase tracking-[0.18em] text-white/60">Quality score</p>
        <p class="mt-12 text-42 font-800">{{ qualityScore }}</p>
      </div>
      <div class="rounded-20 bg-brand-gold/16 p-18">
        <p class="text-12 uppercase tracking-[0.18em] text-slate-500">Encouragement</p>
        <p class="mt-12 text-15 leading-6 text-brand-ink">{{ summary }}</p>
      </div>
    </div>
  </section>
</template>
