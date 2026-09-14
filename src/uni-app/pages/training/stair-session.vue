<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import StairTrainingPanel from '../../../components/training/StairTrainingPanel.vue'
import {
  resolveStairTrainingInstruction,
  resolveStairTrainingStage,
  stairCompletionTtsCue,
  stairScheduledTtsCues,
  stairSprintDurationSeconds,
  stairSprintStartSeconds,
  stairTrainingDurationSeconds,
  stairTrainingSafetyNotice,
  stairTrainingTtsCues
} from '../../../features/training/stairTrainingGuide'
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
import {
  startHorizontalEvidenceCapture,
  type HorizontalEvidenceSession
} from '../../platform/horizontalEvidence'
import {
  configureTrainingAudioOutput,
  createTrainingTtsPlayer
} from '../../platform/trainingTts'
import type { StairSessionSummary } from '../../api/studentBackendTypes'

const store = useStudentStore()
let trainingSessionId = createTrainingSessionId('stairs')
const LIVE_METRICS_INTERVAL_MS = 500
const QUESTIONNAIRE_NAVIGATION_TIMEOUT_MS = 5_000
const SESSION_TIMER_INTERVAL_MS = 250
let timerId: ReturnType<typeof setInterval> | null = null
let sessionStartedAtMs: number | null = null
let liveMetricsTimerId: ReturnType<typeof setInterval> | null = null
let captureGeneration = 0
let captureSession: StairSensorCaptureSession | null = null
let captureStartPromise: Promise<StairSensorCaptureSession | null> | null = null
let captureStopPromise: Promise<StairCaptureResult | null> | null = null
let horizontalCapturePromise: Promise<HorizontalEvidenceSession | null> | null = null
let horizontalEvidenceSession: HorizontalEvidenceSession | null = null
let horizontalEvidenceResultPromise: Promise<Awaited<ReturnType<HorizontalEvidenceSession['stop']>> | null> | null = null
let sprintCaptureStarted = false
let sprintCaptureEnded = false
const ttsPlayer = createTrainingTtsPlayer()
const secondsLeft = shallowRef(stairTrainingDurationSeconds)
const isRunning = shallowRef(false)
const isFinishing = shallowRef(false)
const questionnaireNavigationState = shallowRef<'idle' | 'opening' | 'failed'>('idle')
const cadenceSpm = shallowRef(0)
const estimatedStepCount = shallowRef(0)
const estimatedVerticalSpeedMps = shallowRef(0)
const estimatedFloorsPerMin = shallowRef(0)
const confidence = shallowRef(0)
const sensorStatus = shallowRef<'ready' | 'collecting' | 'stopped' | 'unavailable'>('ready')
const sampleCount = shallowRef(0)

type StairCaptureResult = Awaited<ReturnType<StairSensorCaptureSession['stop']>>

const elapsedSeconds = computed(() => stairTrainingDurationSeconds - secondsLeft.value)
const currentStage = computed(() => resolveStairTrainingStage(elapsedSeconds.value))
const currentInstruction = computed(() => resolveStairTrainingInstruction(elapsedSeconds.value))

void ttsPlayer.preload(stairTrainingTtsCues.map(cue => cue.audio_url))
  .catch(error => reportBackendSyncError('楼梯训练语音预加载', error))

onLoad((query) => {
  trainingSessionId = query?.sessionId?.toString() || trainingSessionId
})

function resetLiveMetrics() {
  cadenceSpm.value = 0
  estimatedStepCount.value = 0
  estimatedVerticalSpeedMps.value = 0
  estimatedFloorsPerMin.value = 0
  confidence.value = 0
  sampleCount.value = 0
}

function syncLiveMetrics(
  analysis: SensorSessionAnalysis,
  samplesLength: number,
  isLiveSnapshot = false
) {
  cadenceSpm.value = isLiveSnapshot && Number.isFinite(analysis.provisionalCadenceSpm)
    ? analysis.provisionalCadenceSpm
    : analysis.cadenceSpmAvg
  estimatedStepCount.value = analysis.estimatedStepCount
  estimatedVerticalSpeedMps.value = analysis.estimatedVerticalSpeedMps
  estimatedFloorsPerMin.value = analysis.estimatedFloorsPerMin
  confidence.value = analysis.confidence
  sampleCount.value = samplesLength
}

function sprintElapsedSeconds() {
  return Math.max(0, Math.min(
    stairSprintDurationSeconds,
    elapsedSeconds.value - stairSprintStartSeconds
  ))
}

function refreshLiveSnapshot() {
  if (!captureSession) return

  const snapshot = captureSession.getSnapshot({
    durationSeconds: sprintElapsedSeconds(),
    completedIntervals: isRunning.value && !sprintCaptureEnded ? 1 : 0
  })
  syncLiveMetrics(snapshot.analysis, snapshot.samples.length, true)
}

function beginSprintCapture() {
  if (sprintCaptureStarted || !isRunning.value || isFinishing.value) return

  sprintCaptureStarted = true
  sensorStatus.value = 'collecting'
  const startGeneration = captureGeneration
  horizontalEvidenceSession = null
  horizontalCapturePromise = startHorizontalEvidenceCapture()
    .then(session => {
      if (startGeneration !== captureGeneration) {
        void session.stop().catch(error => reportBackendSyncError('楼梯训练定位停止', error))
        return null
      }
      horizontalEvidenceSession = session
      return session
    })
    .catch(error => {
      reportBackendSyncError('楼梯训练定位采集', error)
      return null
    })

  captureStartPromise = startStairSensorCapture({ completedIntervals: 0 })
    .then(session => {
      if (startGeneration !== captureGeneration) {
        void session.stop({
          durationSeconds: 0,
          completedIntervals: 0
        }).catch(error => reportBackendSyncError('楼梯训练传感器停止', error))
        return null
      }
      captureSession = session
      refreshLiveSnapshot()
      liveMetricsTimerId = setInterval(refreshLiveSnapshot, LIVE_METRICS_INTERVAL_MS)
      return session
    })
    .catch(error => {
      if (startGeneration === captureGeneration) sensorStatus.value = 'unavailable'
      reportBackendSyncError('楼梯训练传感器启动', error)
      return null
    })
}

function clearLiveMetricsTimer() {
  if (!liveMetricsTimerId) return
  clearInterval(liveMetricsTimerId)
  liveMetricsTimerId = null
}

function finishSprintCapture(completedIntervals: 0 | 1) {
  if (captureStopPromise) return captureStopPromise

  sprintCaptureEnded = true
  clearLiveMetricsTimer()
  const stopGeneration = captureGeneration
  captureStopPromise = (async () => {
    const activeSession = captureSession ?? await captureStartPromise
    captureSession = null
    if (!activeSession) {
      sensorStatus.value = 'unavailable'
      return null
    }

    try {
      const result = await activeSession.stop({
        durationSeconds: stairSprintDurationSeconds,
        completedIntervals
      })
      if (stopGeneration === captureGeneration) {
        syncLiveMetrics(result.analysis, result.samples.length)
        sensorStatus.value = 'stopped'
      }
      return result
    } catch (error) {
      if (stopGeneration === captureGeneration) sensorStatus.value = 'unavailable'
      reportBackendSyncError('楼梯训练传感器停止', error)
      return null
    }
  })()
  return captureStopPromise
}

function collectHorizontalEvidence() {
  if (horizontalEvidenceResultPromise) return horizontalEvidenceResultPromise

  horizontalEvidenceResultPromise = (async () => {
    const session = horizontalEvidenceSession ?? await horizontalCapturePromise
    horizontalCapturePromise = null
    horizontalEvidenceSession = null
    if (!session) return null
    return session.stop().catch(error => {
      reportBackendSyncError('楼梯训练定位停止', error)
      return null
    })
  })()
  return horizontalEvidenceResultPromise
}

function startTimer() {
  if (timerId || isRunning.value || isFinishing.value) return

  configureTrainingAudioOutput()
  secondsLeft.value = stairTrainingDurationSeconds
  resetLiveMetrics()
  sensorStatus.value = 'ready'
  questionnaireNavigationState.value = 'idle'
  sprintCaptureStarted = false
  sprintCaptureEnded = false
  captureStartPromise = null
  captureStopPromise = null
  horizontalCapturePromise = null
  horizontalEvidenceResultPromise = null
  isRunning.value = true
  sessionStartedAtMs = Date.now()
  ttsPlayer.schedule(stairScheduledTtsCues)

  timerId = setInterval(() => {
    if (sessionStartedAtMs === null) return
    const elapsed = Math.min(
      stairTrainingDurationSeconds,
      Math.floor((Date.now() - sessionStartedAtMs) / 1000)
    )
    secondsLeft.value = stairTrainingDurationSeconds - elapsed

    if (elapsed >= stairSprintStartSeconds && !sprintCaptureStarted) {
      beginSprintCapture()
    }
    if (
      elapsed >= stairSprintStartSeconds + stairSprintDurationSeconds
      && sprintCaptureStarted
      && !sprintCaptureEnded
    ) {
      void finishSprintCapture(1)
      void collectHorizontalEvidence()
    }
    if (secondsLeft.value <= 0) {
      clearSessionTimer()
      void finishSession()
    }
  }, SESSION_TIMER_INTERVAL_MS)
}

function clearSessionTimer() {
  if (timerId) clearInterval(timerId)
  timerId = null
  sessionStartedAtMs = null
}

function resolveSummaryPayload(analysis: SensorSessionAnalysis): StairSessionSummary {
  return {
    summaryText: analysis.summary,
    estimatedStepCount: analysis.estimatedStepCount,
    activeClimbSeconds: analysis.activeClimbSeconds,
    cadenceSpmAvg: analysis.cadenceSpmAvg,
    cadenceSpmPeak: analysis.cadenceSpmPeak,
    cadenceStability: analysis.cadenceStability,
    pauseCount: analysis.pauseCount,
    confidence: analysis.confidence
  }
}

async function finishSession() {
  if (isFinishing.value) return

  isFinishing.value = true
  clearSessionTimer()
  clearLiveMetricsTimer()
  isRunning.value = false
  const captureResult = await finishSprintCapture(1)
  const analysis = captureResult?.analysis ?? createSensorSessionAnalysis({
    durationSeconds: stairSprintDurationSeconds,
    completedIntervals: 0
  })
  if (!captureResult) sensorStatus.value = 'unavailable'
  const horizontalEvidence = await collectHorizontalEvidence()

  const gpsEligible = !horizontalEvidence
    || !horizontalEvidence.available
    || horizontalEvidence.isImmobile
  const measurementEligible = analysis.isEligibleForCompletion && gpsEligible
  // Completion is defined by reaching the end of the guided five-minute
  // protocol. Sensor and location quality remain useful feedback and metrics,
  // but they must not revoke the completed training fact locally.
  const countsAsCompletion = true
  let summaryText = analysis.summary
  if (analysis.isEligibleForCompletion && !gpsEligible) {
    summaryText = '本次已完成楼梯引导，但检测到水平移动明显；楼梯动作质量仅作反馈。'
  } else if (!analysis.isEligibleForCompletion) {
    summaryText = analysis.estimatedStepCount > 0 && !analysis.isAscentEvidence
      ? '本次已完成楼梯引导，但竖直上升证据不足；楼梯动作质量仅作反馈。'
      : '本次已完成楼梯引导，传感器数据不足；楼梯动作质量仅作反馈。'
  } else if (horizontalEvidence && !horizontalEvidence.available) {
    summaryText = `${summaryText}（未获取到有效定位证据，仅按运动传感器记录。）`
  }

  const summaryPayload = resolveSummaryPayload(analysis)
  summaryPayload.summaryText = summaryText
  const completedAt = new Date().toISOString()

  void studentBackendSync.syncStairSession({
    sessionId: trainingSessionId,
    durationSeconds: stairTrainingDurationSeconds,
    completedIntervals: measurementEligible ? analysis.completedIntervals : 0,
    qualityScore: analysis.qualityScore,
    summary: summaryPayload,
    completedAt
  }).catch(error => reportBackendSyncError('楼梯训练同步', error))

  store.completeTrainingSession({
    sessionId: trainingSessionId,
    modality: 'stair',
    qualityScore: analysis.qualityScore,
    summary: summaryText,
    capturedBy: analysis.capturedBy,
    countsAsCompletion
  })
  useTrainingProgress().invalidate()
  invalidateGrowthOverview()

  await ttsPlayer.replace([stairCompletionTtsCue.audio_url])
  await notifyTrainingComplete().catch(error => reportBackendSyncError('楼梯训练完成提示', error))
  await openShortQuestionnaire()
}

async function openShortQuestionnaire() {
  if (questionnaireNavigationState.value === 'opening') return

  questionnaireNavigationState.value = 'opening'
  try {
    await redirectToShortQuestionnaire()
  } catch (error) {
    questionnaireNavigationState.value = 'failed'
    isFinishing.value = false
    reportBackendSyncError('楼梯训练问卷跳转', error)
  }
}

function redirectToShortQuestionnaire() {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      settle(() => reject(new Error('Stair questionnaire navigation timed out.')))
    }, QUESTIONNAIRE_NAVIGATION_TIMEOUT_MS)

    function settle(action: () => void) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      action()
    }

    try {
      Promise.resolve(uni.redirectTo({
        url: `/pages/training/short-questionnaire?sessionId=${encodeURIComponent(trainingSessionId)}`
      })).then(
        () => settle(resolve),
        error => settle(() => reject(error))
      )
    } catch (error) {
      settle(() => reject(error))
    }
  })
}

function resetCaptureState() {
  captureSession = null
  captureStartPromise = null
  captureStopPromise = null
  horizontalCapturePromise = null
  horizontalEvidenceSession = null
  horizontalEvidenceResultPromise = null
  sprintCaptureStarted = false
  sprintCaptureEnded = false
}

function stopActiveCapture() {
  if (isFinishing.value) return

  captureGeneration += 1
  clearSessionTimer()
  clearLiveMetricsTimer()
  ttsPlayer.reset()
  isRunning.value = false
  const activeSession = captureSession
  captureSession = null
  void collectHorizontalEvidence()

  if (activeSession) {
    void activeSession.stop({
      durationSeconds: sprintElapsedSeconds(),
      completedIntervals: 0
    }).catch(error => reportBackendSyncError('楼梯训练传感器停止', error))
  }

  secondsLeft.value = stairTrainingDurationSeconds
  sensorStatus.value = 'ready'
  resetLiveMetrics()
  resetCaptureState()
}

function interruptSession() {
  stopActiveCapture()
  void uni.switchTab({ url: '/pages/training/select' })
}

onHide(() => {
  if (isFinishing.value) {
    ttsPlayer.reset()
    return
  }
  stopActiveCapture()
})

onBeforeUnmount(() => {
  if (!isFinishing.value) stopActiveCapture()
  ttsPlayer.destroy()
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
      :is-finishing="isFinishing"
      :seconds-left="secondsLeft"
      :stage-label="currentStage.label"
      :stage-id="currentStage.id"
      :current-instruction="currentInstruction"
      :safety-notice="stairTrainingSafetyNotice"
      :cadence-spm="cadenceSpm"
      :estimated-step-count="estimatedStepCount"
      :estimated-vertical-speed-mps="estimatedVerticalSpeedMps"
      :estimated-floors-per-min="estimatedFloorsPerMin"
      :confidence="confidence"
      :sensor-status="sensorStatus"
      :sample-count="sampleCount"
      :questionnaire-navigation-state="questionnaireNavigationState"
      @interrupt="interruptSession"
      @start="startTimer"
      @continue-questionnaire="openShortQuestionnaire"
    />
  </UniTrainingPageShell>
</template>
