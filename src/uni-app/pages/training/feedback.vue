<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import SessionFeedbackCard from '../../../components/training/SessionFeedbackCard.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const sessionId = ref('latest')

onLoad((query) => {
  const nextQuery = query ?? {}
  sessionId.value = nextQuery.sessionId?.toString() ?? 'latest'
})

onShow(() => {
  store.refreshReminderEligibility()
})

const session = computed(() => {
  const snapshot = store.getSnapshot()
  if (sessionId.value === 'latest') {
    return snapshot.sessions.at(-1) ?? null
  }

  return snapshot.sessions.find(item => item.id === sessionId.value) ?? null
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

function goHome() {
  void uni.redirectTo({
    url: '/pages/training/home'
  })
}

function goGrowthCenter() {
  void uni.redirectTo({
    url: '/pages/growth/index'
  })
}
</script>

<template>
  <UniTrainingPageShell>
    <SessionFeedbackCard
      :modality-label="modalityLabel"
      :quality-score="session?.analysis.qualityScore ?? 0"
      :summary="session?.analysis.summary ?? 'Great work finishing the guided flow.'"
    />

    <div class="flex gap-12">
      <button
        class="flex-1 rounded-full border-none bg-brand-coral px-16 py-14 text-15 font-700 text-white"
        type="button"
        @click="goHome"
      >
        Back home
      </button>
      <button
        class="rounded-full border-none bg-slate-100 px-16 py-14 text-15 font-600 text-slate-600"
        type="button"
        @click="goGrowthCenter"
      >
        Growth center
      </button>
    </div>
  </UniTrainingPageShell>
</template>
