<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import StairTrainingPanel from '../../../components/training/StairTrainingPanel.vue'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import { createTrainingSessionId } from '../../platform/trainingSessionId'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { invalidateGrowthOverview } from '../../composables/useGrowthOverview'
import { useStudentStore } from '../../composables/useStudentStore'
import { useTrainingProgress } from '../../composables/useTrainingProgress'
import { notifyTrainingComplete } from '../../platform/trainingFeedback'
import {
  createSensorSessionAnalysis,
  startStairSensorCapture,
  type SensorSessionAnalysis,
  type StairSensorCaptureSession
} from '../../platform/sensors'
import type { StairSessionSummary } from '../../api/studentBackendTypes'

const store = useStudentStore()
const trainingSessionId = createTrainingSessionId('stairs')
let timerId: ReturnType<typeof setInterval> | null = null
let captureSession: StairSensorCaptureSession | null = null
const secondsLeft = shallowRef(30)
const isRunning = shallowRef(false)
const isFinishing = shallowRef(false)
const cadenceSpm = shallowRef(0)
const estimatedStepCount = shallowRef(0)
const estimatedVerticalSpeedMps = shallowRef(0)
const estimatedFloorsPerMin = shallowRef(0)
const confidence = shallowRef(0)
const sensorStatus = shallowRef<'ready' | 'collecting' | 'stopped' | 'unavailable'>('ready')
const sampleCount = shallowRef(0)

function resetLiveMetrics() {
  cadenceSpm.value = 0
  estimatedStepCount.value = 0
  estimatedVerticalSpeedMps.value = 0
  estimatedFloorsPerMin.value = 0
  confidence.value = 0
  sampleCount.value = 0
}

function syncLiveMetrics(analysis: SensorSessionAnalysis, samplesLength: number) {
  cadenceSpm.value = analysis.cadenceSpmAvg
  estimatedStepCount.value = analysis.estimatedStepCount
  estimatedVerticalSpeedMps.value = analysis.estimatedVerticalSpeedMps
  estimatedFloorsPerMin.value = analysis.estimatedFloorsPerMin
  confidence.value = analysis.confidence
  sampleCount.value = samplesLength
}

function refreshLiveSnapshot() {
  if (!captureSession) {
    return
  }

  const snapshot = captureSession.getSnapshot({
    durationSeconds: 30 - secondsLeft.value,
    completedIntervals: isRunning.value ? 1 : 0
  })

  syncLiveMetrics(snapshot.analysis, snapshot.samples.length)
}

async function startTimer() {
  if (timerId || isRunning.value || isFinishing.value) {
    return
  }

  secondsLeft.value = 30
  resetLiveMetrics()
  sensorStatus.value = 'collecting'
  isRunning.value = true

  try {
    captureSession = await startStairSensorCapture({
      completedIntervals: 0
    })
    refreshLiveSnapshot()
  } catch (error) {
    captureSession = null
    sensorStatus.value = 'unavailable'
    isRunning.value = false
    reportBackendSyncError('楼梯训练传感器启动', error)
    return
  }

  timerId = setInterval(() => {
    secondsLeft.value -= 1
    refreshLiveSnapshot()

    if (secondsLeft.value <= 0) {
      clearTimer()
      void finishSession()
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

function resolveSummaryPayload(
  analysis: SensorSessionAnalysis
): StairSessionSummary {
  return {
    summaryText: analysis.summary,
    estimatedStepCount: analysis.estimatedStepCount,
    activeClimbSeconds: analysis.activeClimbSeconds,
    cadenceSpmAvg: analysis.cadenceSpmAvg,
    cadenceSpmPeak: analysis.cadenceSpmPeak,
    cadenceStability: analysis.cadenceStability,
    estimatedVerticalSpeedMps: analysis.estimatedVerticalSpeedMps,
    estimatedFloorsPerMin: analysis.estimatedFloorsPerMin,
    pauseCount: analysis.pauseCount,
    confidence: analysis.confidence
  }
}

async function finishSession() {
  if (isFinishing.value) {
    return
  }

  isFinishing.value = true
  clearTimer()
  isRunning.value = false
  const durationSeconds = 30 - secondsLeft.value
  const completedIntervals = durationSeconds > 0 ? 1 : 0
  const captureResult = captureSession
    ? await captureSession.stop({
        durationSeconds,
        completedIntervals
      })
    : null
  captureSession = null
  const analysis = captureResult?.analysis ?? createSensorSessionAnalysis({
    durationSeconds,
    completedIntervals
  })
  syncLiveMetrics(analysis, captureResult?.samples.length ?? 0)
  sensorStatus.value = captureResult ? 'stopped' : 'unavailable'
  const summaryPayload = resolveSummaryPayload(analysis)
  const completedAt = new Date().toISOString()

  await notifyTrainingComplete()

  try {
    await studentBackendSync.syncStairSession({
      sessionId: trainingSessionId,
      durationSeconds,
      completedIntervals,
      qualityScore: analysis.qualityScore,
      summary: summaryPayload,
      completedAt
    })
  } catch (error) {
    reportBackendSyncError('楼梯训练同步', error)
  }

  store.completeTrainingSession({
    sessionId: trainingSessionId,
    modality: 'stair',
    qualityScore: analysis.qualityScore,
    summary: analysis.summary,
    capturedBy: analysis.capturedBy
  })
  useTrainingProgress().invalidate()
  invalidateGrowthOverview()
  void uni.redirectTo({
    url: `/pages/training/short-questionnaire?sessionId=${encodeURIComponent(trainingSessionId)}`
  })
}

function stopActiveCapture() {
  // Natural completion owns the capture from this point; a hide or unmount
  // racing the finish flow must not clobber its final state.
  if (isFinishing.value) return

  clearTimer()
  isRunning.value = false
  const activeSession = captureSession
  captureSession = null

  // The 30-second interval was interrupted, so it is not credited as a
  // completed interval — only a timer-driven finish may report one.
  if (activeSession) {
    void activeSession.stop({
      durationSeconds: 30 - secondsLeft.value,
      completedIntervals: 0
    }).catch(error => reportBackendSyncError('楼梯训练传感器停止', error))
  }

  // Leave the panel in a clean ready state for the next run — the truncated
  // capture cannot resume, so stale countdown/metric values would mislead.
  secondsLeft.value = 30
  sensorStatus.value = 'ready'
  resetLiveMetrics()
}

function interruptSession() {
  stopActiveCapture()

  void uni.switchTab({
    url: '/pages/training/select'
  })
}

onHide(() => {
  stopActiveCapture()
})

onBeforeUnmount(() => {
  stopActiveCapture()
})
</script>

<template>
  <UniTrainingPageShell
    dock-tab="playground"
    :show-dock="false"
    show-decorations
    :fit-viewport="true"
    page-title="阶梯训练"
    show-back
    access-mode="execute"
  >
    <StairTrainingPanel
      :is-running="isRunning"
      :seconds-left="secondsLeft"
      :cadence-spm="cadenceSpm"
      :estimated-step-count="estimatedStepCount"
      :estimated-vertical-speed-mps="estimatedVerticalSpeedMps"
      :estimated-floors-per-min="estimatedFloorsPerMin"
      :confidence="confidence"
      :sensor-status="sensorStatus"
      :sample-count="sampleCount"
      @interrupt="interruptSession"
      @start="startTimer"
    />
  </UniTrainingPageShell>
</template>
