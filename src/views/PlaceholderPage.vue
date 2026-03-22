<script setup lang="ts">
interface Props {
  title?: string
  checkpoint?: string
  modality?: string
  sessionId?: string
}

const props = defineProps<Props>()
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-20 px-20 py-24">
    <section class="card-shell p-24">
      <p class="chip-soft bg-brand-gold/20 text-brand-ink">Student Miniapp</p>
      <h1 class="mt-14 text-28 font-800 leading-tight text-brand-ink">
        {{ props.title ?? props.checkpoint ?? props.modality ?? props.sessionId }}
      </h1>
      <p class="mt-12 text-14 leading-6 text-slate-600">
        Foundation scaffold in progress.
      </p>
    </section>
  </main>
</template>
