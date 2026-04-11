<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import StairTrainingPanel from '../../../components/training/StairTrainingPanel.vue'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
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

async function finishSession() {
  clearTimer()
  const durationSeconds = 30 - secondsLeft.value
  const completedIntervals = durationSeconds > 0 ? 1 : 0
  const analysis = createSensorSessionAnalysis({
    durationSeconds,
    completedIntervals
  })

  try {
    await studentBackendSync.syncStairSession({
      durationSeconds,
      completedIntervals,
      qualityScore: analysis.qualityScore,
      summary: analysis.summary
    })
  } catch (error) {
    reportBackendSyncError('楼梯训练同步', error)
  }

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
  <UniTrainingPageShell dock-tab="playground">
    <StairTrainingPanel
      :seconds-left="secondsLeft"
      @complete="finishSession"
      @interrupt="interruptSession"
      @start="startTimer"
    />
  </UniTrainingPageShell>
</template>
