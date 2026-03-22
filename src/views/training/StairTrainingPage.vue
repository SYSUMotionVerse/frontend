<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import StairTrainingPanel from '../../components/training/StairTrainingPanel.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'

const router = useRouter()
const { completeTrainingSession } = useStudentAppState()
let timerId: ReturnType<typeof setInterval> | null = null
const secondsLeft = shallowRef(30)

function startTimer() {
  if (timerId) {
    return
  }

  secondsLeft.value = 30
  timerId = setInterval(() => {
    secondsLeft.value -= 1

    if (secondsLeft.value <= 0) {
      clearTimer()
    }
  }, 1000)
}

function clearTimer() {
  if (!timerId) {
    return
  }

  clearInterval(timerId)
  timerId = null
}

function finishSession() {
  clearTimer()
  completeTrainingSession({
    modality: 'stair',
    qualityScore: 69,
    summary: 'Sensor capture stayed stable — try a slightly higher knee drive next round.',
    capturedBy: 'sensor'
  })
  void router.push('/questionnaires/short/post-training')
}

function interruptSession() {
  clearTimer()
  void router.push('/training/select')
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-18 px-20 py-24">
    <StairTrainingPanel
      :seconds-left="secondsLeft"
      @complete="finishSession"
      @interrupt="interruptSession"
      @start="startTimer"
    />
  </main>
</template>
