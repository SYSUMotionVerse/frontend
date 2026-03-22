<script setup lang="ts">
import TrainingModeCard from '../../../components/training/TrainingModeCard.vue'
import type { TrainingModality } from '../../../domain/student/types'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'

function chooseMode(modality: TrainingModality) {
  if (modality === 'stair') {
    void uni.navigateTo({
      url: '/pages/training/stair-session'
    })
    return
  }

  void uni.navigateTo({
    url: `/pages/training/visual-session?modality=${modality}`
  })
}
</script>

<template>
  <UniTrainingPageShell>
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
  </UniTrainingPageShell>
</template>
