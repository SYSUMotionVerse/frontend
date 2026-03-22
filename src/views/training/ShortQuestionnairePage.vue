<script setup lang="ts">
import { shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import ShortQuestionnaireForm from '../../components/training/ShortQuestionnaireForm.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'

const router = useRouter()
const { submitShortQuestionnaireForLatestSession } = useStudentAppState()
const latestResponse = shallowRef<{ energyLevel: number; confidence: number; enjoyment: number } | null>(null)

function submitResponse(payload: { energyLevel: number; confidence: number; enjoyment: number }) {
  latestResponse.value = payload
  submitShortQuestionnaireForLatestSession(payload)
  void router.push('/feedback/latest')
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-18 px-20 py-24">
    <ShortQuestionnaireForm @submit="submitResponse" />

    <section v-if="latestResponse" class="card-shell p-18 text-14 text-slate-600">
      Last response: energy {{ latestResponse.energyLevel }}, confidence {{ latestResponse.confidence }}, enjoyment {{ latestResponse.enjoyment }}
    </section>
  </main>
</template>
