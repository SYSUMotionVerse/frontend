<script setup lang="ts">
import { shallowRef } from 'vue'
import ShortQuestionnaireForm from '../../../components/training/ShortQuestionnaireForm.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const latestResponse = shallowRef<{ energyLevel: number; confidence: number; enjoyment: number } | null>(null)

function submitResponse(payload: { energyLevel: number; confidence: number; enjoyment: number }) {
  latestResponse.value = payload
  store.submitShortQuestionnaireForLatestSession(payload)
  void uni.redirectTo({
    url: '/pages/training/feedback?sessionId=latest'
  })
}
</script>

<template>
  <UniTrainingPageShell>
    <ShortQuestionnaireForm @submit="submitResponse" />

    <section v-if="latestResponse" class="card-shell p-18 text-14 text-slate-600">
      Last response: energy {{ latestResponse.energyLevel }}, confidence {{ latestResponse.confidence }}, enjoyment {{ latestResponse.enjoyment }}
    </section>
  </UniTrainingPageShell>
</template>
