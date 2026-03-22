<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SessionFeedbackCard from '../../components/training/SessionFeedbackCard.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'

const route = useRoute()
const router = useRouter()
const { state, refreshReminderEligibility } = useStudentAppState()

const session = computed(() => {
  if (route.params.sessionId === 'latest') {
    return state.sessions.at(-1) ?? null
  }

  return state.sessions.find(item => item.id === route.params.sessionId) ?? null
})

const modalityLabel = computed(() => {
  if (!session.value) {
    return 'Session'
  }

  return session.value.modality === 'stair'
    ? 'Stair-climbing'
    : session.value.modality === 'hiit'
      ? 'HIIT'
      : 'Wushu'
})

refreshReminderEligibility()
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-18 px-20 py-24">
    <SessionFeedbackCard
      :modality-label="modalityLabel"
      :quality-score="session?.analysis.qualityScore ?? 0"
      :summary="session?.analysis.summary ?? 'Great work finishing the guided flow.'"
    />

    <div class="flex gap-12">
      <button
        class="flex-1 rounded-full border-none bg-brand-coral px-16 py-14 text-15 font-700 text-white"
        type="button"
        @click="router.push('/home')"
      >
        Back home
      </button>
      <button
        class="rounded-full border-none bg-slate-100 px-16 py-14 text-15 font-600 text-slate-600"
        type="button"
        @click="router.push('/growth')"
      >
        Growth center
      </button>
    </div>
  </main>
</template>
