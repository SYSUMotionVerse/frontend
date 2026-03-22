<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import StairTrainingPanel from '../../../components/training/StairTrainingPanel.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { createSensorSessionAnalysis } from '../../platform/sensors'

const store = useStudentStore()
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
  const analysis = createSensorSessionAnalysis({
    durationSeconds: 30 - secondsLeft.value,
    completedIntervals: 1
  })

  store.completeTrainingSession({
    modality: 'stair',
    qualityScore: analysis.qualityScore,
    summary: analysis.summary,
    capturedBy: analysis.capturedBy
  })
  void uni.redirectTo({
    url: '/pages/training/short-questionnaire'
  })
}

function interruptSession() {
  clearTimer()
  void uni.redirectTo({
    url: '/pages/training/select'
  })
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <UniTrainingPageShell>
    <StairTrainingPanel
      :seconds-left="secondsLeft"
      @complete="finishSession"
      @interrupt="interruptSession"
      @start="startTimer"
    />
  </UniTrainingPageShell>
</template>
