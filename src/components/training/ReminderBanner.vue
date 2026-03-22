<script setup lang="ts">
defineProps<{
  visible: boolean
}>()
</script>

<template>
  <section
    v-if="visible"
    class="card-shell border-1 border-brand-gold/40 bg-brand-gold/12 p-18 text-brand-ink"
  >
    <p class="text-15 font-800 tracking-[0.16em] uppercase">Reminder return</p>
    <p class="mt-10 text-17 leading-7">
      You came back from the 18:00 reminder. One more short session keeps today moving.
    </p>
  </section>
</template>
