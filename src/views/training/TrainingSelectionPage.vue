<script setup lang="ts">
import { useRouter } from 'vue-router'
import TrainingModeCard from '../../components/training/TrainingModeCard.vue'
import type { TrainingModality } from '../../types/student'

const router = useRouter()

function chooseMode(modality: TrainingModality) {
  if (modality === 'stair') {
    void router.push('/training/stairs')
    return
  }

  void router.push(`/training/visual/${modality}`)
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-18 px-20 py-24">
    <section class="card-shell p-20">
      <p class="section-title">Pick your session</p>
      <p class="mt-10 text-17 leading-7 text-slate-600">
        Every session can be a new modality choice.
      </p>
    </section>

    <TrainingModeCard
      accent-class="bg-brand-coral/16 text-brand-coral"
      description="Camera-guided martial movement with split-screen feedback."
      modality="wushu"
      title="Wushu"
      @choose="chooseMode"
    />
    <TrainingModeCard
      accent-class="bg-brand-gold/22 text-brand-ink"
      description="Fast, rhythmic intervals with live camera placeholders."
      modality="hiit"
      title="HIIT"
      @choose="chooseMode"
    />
    <TrainingModeCard
      accent-class="bg-brand-teal/16 text-brand-ink"
      description="A 30-second motion-sensor burst for stair-climbing practice."
      modality="stair"
      title="Stair-climbing"
      @choose="chooseMode"
    />
  </main>
</template>
