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
  <UniTrainingPageShell :show-dock="false">
    <ShortQuestionnaireForm @submit="submitResponse" />

    <section v-if="latestResponse" class="card-shell p-18 text-14 text-slate-600">
      上次反馈：精力 {{ latestResponse.energyLevel }}，信心 {{ latestResponse.confidence }}，愉悦度 {{ latestResponse.enjoyment }}
    </section>
  </UniTrainingPageShell>
</template>
