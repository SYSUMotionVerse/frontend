// The visual-session controller is loaded only with the training subpackage.
import { computed, onBeforeUnmount, shallowRef, watch, type ShallowRef } from 'vue'
import type { TrainingModality } from '../../../domain/student/types'
import type {
  ExerciseArrangementDetail,
  ExerciseArrangementItem,
  ExerciseRecordBrief,
  ExerciseScoreDetails,
  ExerciseVideoSummary,
  TrainingTtsPhase,
  TutorialResponse
} from '../../../uni-app/api/studentBackendTypes'
import { buildVisualPoseAnalysisPayload, studentBackendSync } from '../../../uni-app/api/studentBackend'
import {
  formatBackendErrorMessage,
  reportBackendSyncError
} from '../../../uni-app/api/reportBackendSyncError'
import type { DetectResult } from '../components/pose/PoseDetectModel'
import type { PoseAngleFrame } from '../../../uni-app/components/pose/poseAnalysis'
import { useStudentStore } from '../../../uni-app/composables/useStudentStore'
import { useVisualTrainingSubmission } from '../../../uni-app/composables/useVisualTrainingSubmission'
import { invalidateGrowthOverview } from '../../../uni-app/composables/useGrowthOverview'
import { useTrainingProgress } from '../../../uni-app/composables/useTrainingProgress'
import { trainingVideoCache } from '../../../uni-app/platform/videoCache'
import {
  ACTION_STANDARD_PRELOAD_CONCURRENCY,
  actionStandardLoader,
  mapWithConcurrency
} from '../../../uni-app/platform/actionStandardLoader'
import { createTrainingTtsPlayer } from '../../../uni-app/platform/trainingTts'
import {
  createDefaultTrainingWebAudioRuntime,
  createTrainingSoundscape,
  type TrainingWebAudioContextLike
} from '../../../uni-app/platform/trainingSoundscape'
import { createTrainingAudioClock } from '../../../uni-app/platform/trainingAudioClock'
import { resolveNextWholeSecondDelayMs } from '../../../uni-app/platform/anchoredTimeline'
import { aggregateActionScores, scoreAction } from '../../../domain/training/actionScoring'
import {
  ACTION_SCORING_VERSION,
  type ActionMotion,
  type ActionStandard,
  type ScoredActionResult
} from '../../../domain/training/actionScoringTypes'
import {
  buildVisualWorkoutTimeline,
  initialPreviewDurationSeconds,
  resolveCountdownDuration,
  resolvePretrainingDuration,
  resolvePretrainingMode,
  resolveVisualWorkoutState,
  type VisualTrainingPlaybackState,
  type VisualWorkoutPhaseKind,
  type VisualWorkoutPhaseSlot,
  type VisualWorkoutState
} from '../../../features/training/visualWorkoutTimeline'
import {
  buildTrainingAudioPlan,
  resolveTrainingAudioPhasePlan,
  type TrainingAudioPlan,
  type TrainingAudioPhaseSlot
} from '../../../features/training/trainingTtsConfig'

export interface VisualTrainingCaptureApi {
  startRecord: () => Promise<void>
  stopRecord: () => Promise<string>
  startDetect: () => void
  stopDetect: () => void
}

interface UseVisualTrainingSessionOptions {
  modality: ShallowRef<Exclude<TrainingModality, 'stair'>>
  arrangementId: ShallowRef<number | null>
}

type PoseRecognitionStatus = 'idle' | 'preparing' | 'ready' | 'failed'

const maxPoseAngleFrames = 18_000
// Each uploaded frame also carries three action-segmentation fields. Keep the
// complete poseAnalysis tree comfortably below the backend's 100k-node budget;
// scoring still uses every locally collected frame.
const maxUploadedPoseAngleFrames = 5_000
const mediaStartWatchdogMs = 15_000
const recordingStopTimeoutMs = 3_000

interface VisualVideoEventEnvelope {
  token?: string
  elementId?: string
  detail?: {
    currentTime?: number
    duration?: number
  }
}

function readVideoEvent(event: unknown): VisualVideoEventEnvelope {
  if (!event || typeof event !== 'object') return {}
  const value = event as Record<string, unknown>
  if ('token' in value || 'elementId' in value || 'detail' in value) {
    return {
      token: typeof value.token === 'string' ? value.token : undefined,
      elementId: typeof value.elementId === 'string' ? value.elementId : undefined,
      detail: value.detail && typeof value.detail === 'object'
        ? value.detail as VisualVideoEventEnvelope['detail']
        : undefined
    }
  }
  return {
    detail: value as VisualVideoEventEnvelope['detail']
  }
}

function toScore(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function toRoundedScore(value: number) {
  return Number(value.toFixed(2))
}

export function buildMissingPoseActionResult(
  item: {
    id: number
    video_id: number
    expected_duration: number
    video: Pick<ExerciseVideoSummary, 'title'>
  },
  standard: Pick<ActionStandard, 'action_id'>,
  frameCount: number
): ScoredActionResult {
  return {
    itemId: item.id,
    videoId: item.video_id,
    actionId: standard.action_id,
    title: item.video.title,
    expectedDuration: item.expected_duration,
    score: 0,
    passed: false,
    feedback: [],
    angleDetails: {},
    frameCount
  }
}

interface ActionPoseSegment {
  itemId: number
  videoId: number
  frames: PoseAngleFrame[]
}

export function samplePoseFramesForUpload(
  frames: readonly PoseAngleFrame[],
  limit = maxUploadedPoseAngleFrames
) {
  const boundedLimit = Math.max(2, Math.floor(limit))
  if (frames.length <= boundedLimit) return [...frames]

  const sampled: PoseAngleFrame[] = []
  const lastIndex = frames.length - 1
  for (let index = 0; index < boundedLimit; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (boundedLimit - 1))
    sampled.push(frames[sourceIndex] as PoseAngleFrame)
  }
  return sampled
}

export function sampleActionPoseSegmentsForUpload(
  segments: readonly ActionPoseSegment[],
  limit = maxUploadedPoseAngleFrames
) {
  const populated = segments.filter(segment => segment.frames.length > 0)
  if (populated.length === 0) return []
  const totalLimit = Math.max(populated.length, Math.floor(limit))
  const baseLimit = Math.floor(totalLimit / populated.length)
  let remainder = totalLimit % populated.length

  return populated.flatMap(segment => {
    const segmentLimit = baseLimit + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return samplePoseFramesForUpload(segment.frames, segmentLimit).map((frame, index) => ({
      ...frame,
      arrangementItemId: segment.itemId,
      videoId: segment.videoId,
      actionFrameIndex: index
    }))
  })
}

function settleWithin<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => resolve(fallback), timeoutMs)
    promise.then(
      value => {
        clearTimeout(timeout)
        resolve(value)
      },
      error => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

function resolveStandardUrl(item: ExerciseArrangementItem) {
  return item.standard_data_url?.trim() || item.video.standard_data_url?.trim() || ''
}

function buildActionMotion(angleFrames: PoseAngleFrame[]): ActionMotion | null {
  const payload = buildVisualPoseAnalysisPayload(angleFrames)
  if (!payload) return null

  return {
    angle_names: payload.angle_names,
    frames: payload.frames.map(frame => ({
      frame_index: frame.frame_index,
      time: frame.time,
      angles: frame.values
    }))
  }
}

export function buildSessionScoringResult(
  actionScores: ScoredActionResult[],
  scoringWarnings: string[],
  expectedItemIds: number[]
) {
  const hasScoredAction = actionScores.some(
    action => Object.keys(action.angleDetails).length > 0
  )
  if (!hasScoredAction) {
    return {
      score: undefined,
      summary: '未识别到人体，暂无评分',
      scoreDetails: undefined,
      scoreUnavailableReason: '未识别到人体，暂无评分'
    }
  }
  const aggregate = aggregateActionScores(
    actionScores,
    scoringWarnings,
    expectedItemIds
  )
  if (aggregate.score === undefined) {
    return {
      score: undefined,
      summary: aggregate.summary,
      scoreDetails: undefined,
      scoreUnavailableReason: aggregate.warnings.join('; ') || 'no_valid_action_score'
    }
  }
  const scoreDetails: ExerciseScoreDetails = {
    overallScore: aggregate.score,
    summary: aggregate.summary,
    dimensions: aggregate.dimensions,
    highlights: aggregate.highlights,
    warnings: aggregate.warnings,
    actionResults: actionScores,
    chartSnapshot: {
      radar: aggregate.dimensions
    }
  }

  return {
    score: aggregate.score,
    summary: aggregate.summary,
    scoreDetails,
    scoreUnavailableReason: undefined
  }
}

export function useVisualTrainingSession(options: UseVisualTrainingSessionOptions) {
  const store = useStudentStore()
  const submission = useVisualTrainingSubmission()
  const capture = shallowRef<VisualTrainingCaptureApi | null>(null)
  const arrangement = shallowRef<ExerciseArrangementDetail | null>(null)
  const cachedVideoPaths = shallowRef<Record<string, string>>({})
  const activeItemIndex = shallowRef(0)
  const phaseKind = shallowRef<VisualWorkoutPhaseKind>('preview')
  const phaseSlot = shallowRef<VisualWorkoutPhaseSlot>('preview')
  const phaseRemainingSeconds = shallowRef(0)
  const countdownAudioPending = shallowRef(false)
  const trainingStarted = shallowRef(false)
  const preparingTraining = shallowRef(false)
  const startCountdown = shallowRef(0)
  const sessionProgressSeconds = shallowRef(0)
  const videoAutoplay = shallowRef(false)
  const videoLoading = shallowRef(true)
  const videoError = shallowRef('')
  const videoEnded = shallowRef(false)
  const videoProgressSeconds = shallowRef(0)
  const videoDurationSeconds = shallowRef(0)
  const playbackState = shallowRef<VisualTrainingPlaybackState>('idle')

  // ── Tutorial mode state ──
  // This route always enters through action guidance. Keep the first rendered
  // frame in tutorial mode while the arrangement request is still in flight.
  const tutorialMode = shallowRef(true)
  const tutorialIndex = shallowRef(0)
  const tutorialText = shallowRef('')
  const tutorialRecords = shallowRef<ExerciseRecordBrief[]>([])
  const tutorialVideoUrlOverride = shallowRef('')
  const tutorialVideoControllable = shallowRef(false)
  const tutorialLoading = shallowRef(false)

  const recording = shallowRef(false)
  const recordSeconds = shallowRef(0)
  const recordedVideoPath = shallowRef('')
  const recognitionEnabled = shallowRef(false)
  const recognitionStatus = shallowRef<PoseRecognitionStatus>('idle')
  const recognitionFps = shallowRef<5 | 10>(5)
  const livePoseFps = shallowRef(0)
  const poseFallbackSampling = shallowRef(false)
  const completing = shallowRef(false)
  const completionError = shallowRef('')
  const poseAngleFrames = shallowRef<PoseAngleFrame[]>([])
  const currentActionFrames = shallowRef<PoseAngleFrame[]>([])
  const actionPoseSegments = shallowRef<ActionPoseSegment[]>([])
  const actionStandards = shallowRef<Record<number, ActionStandard>>({})
  const actionScores = shallowRef<ScoredActionResult[]>([])
  const scoringWarnings = shallowRef<string[]>([])
  const trainingPreparationLabel = shallowRef('')
  const trainingAudioClock = createTrainingAudioClock()
  const sharedWebAudioContext = trainingAudioClock.context as
    | TrainingWebAudioContextLike
    | undefined
  const ttsPlayer = createTrainingTtsPlayer(
    undefined,
    undefined,
    trainingAudioClock.runtime
  )
  const trainingSoundscape = createTrainingSoundscape(
    undefined,
    trainingAudioClock.runtime,
    createDefaultTrainingWebAudioRuntime(sharedWebAudioContext)
  )
  // Decode the two effect assets before training so Web Audio can submit the
  // complete sample-clock timeline as soon as a phase begins.
  void trainingSoundscape.preload()
  let recordTimer: ReturnType<typeof setInterval> | null = null
  let phaseTimer: ReturnType<typeof setTimeout> | null = null
  let mediaStartWatchdogTimer: ReturnType<typeof setTimeout> | null = null
  let mediaStartRecoveryAttempts = 0
  let mediaStartRecoveryPhase = ''
  let startCountdownTimer: ReturnType<typeof setInterval> | null = null
  let cacheWarmupTimer: ReturnType<typeof setTimeout> | null = null
  let standardsReadyPromise: Promise<void> | null = null
  let ttsReadyPromise: Promise<void> | null = null
  let videoRequestId = 0
  let tutorialRequestId = 0
  const videoPhaseGeneration = shallowRef(0)
  let phaseClockGeneration = 0
  let phaseDeadlineMs: number | null = null
  let phaseRemainingExactSeconds = 0
  let startCountdownDeadlineMs: number | null = null
  let practiceStartPending = false
  let preserveStartCountdownAudio = false
  let preserveTrailingModuleGuidance = false
  let disposed = false
  let sessionSuspended = false
  let sessionStopping = false
  let resumeVideoOnShow = false
  let acceptingPoseFrames = false
  let activeActionStartedAtMs = 0
  let resultStored = false
  let resultCountsAsCompletion = false
  let startedMediaGuidanceToken = ''
  let moduleTransitionGeneration = 0
  let moduleTransitionInFlight = false
  let trainingAudioPlan: TrainingAudioPlan | null = null

  function clockNowMs() {
    return trainingAudioClock.nowMs()
  }

  const activeItem = computed(() => arrangement.value?.items?.[activeItemIndex.value] ?? null)
  const primaryVideoId = computed(() => arrangement.value?.items?.[0]?.video_id)
  const exerciseVideo = computed<ExerciseVideoSummary | null>(() => activeItem.value?.video ?? null)
  const sourceVideoUrl = computed(() => exerciseVideo.value?.video_file?.trim() ?? '')
  const videoUrl = computed(() => cachedVideoPaths.value[sourceVideoUrl.value] ?? sourceVideoUrl.value)
  const nextExerciseVideo = computed(() => (
    arrangement.value?.items?.[activeItemIndex.value + 1]?.video ?? null
  ))
  const nextSourceVideoUrl = computed(() => nextExerciseVideo.value?.video_file?.trim() ?? '')
  const nextVideoUrl = computed(() => (
    cachedVideoPaths.value[nextSourceVideoUrl.value] ?? nextSourceVideoUrl.value
  ))
  const videoResetKey = computed(() => `${activeItemIndex.value}:${phaseSlot.value}`)
  const videoEventToken = computed(() => (
    `${videoPhaseGeneration.value}:${phaseSlot.value}:${activeItemIndex.value}:${videoUrl.value}`
  ))
  const videoElementId = computed(() => (
    'follow-along-video'
  ))
  const recognitionReady = computed(() => recognitionStatus.value === 'ready')

  // ── Tutorial computed ──
  const tutorialItem = computed(() => arrangement.value?.items?.[tutorialIndex.value] ?? null)
  const tutorialVideo = computed<ExerciseVideoSummary | null>(() => tutorialItem.value?.video ?? null)
  const tutorialSourceUrl = computed(() => {
    const v = tutorialVideo.value
    return (
      tutorialVideoUrlOverride.value
      || v?.tutorial_video_url?.trim()
      || v?.video_file?.trim()
      || ''
    ).trim()
  })
  const tutorialVideoUrl = computed(() => cachedVideoPaths.value[tutorialSourceUrl.value] ?? tutorialSourceUrl.value)
  const tutorialTotalActions = computed(() => arrangement.value?.items.length ?? 0)
  const tutorialIsLast = computed(() => tutorialIndex.value >= tutorialTotalActions.value - 1)
  // In tutorial mode, show the tutorial item's video instead of the active item's
  const displayVideoUrl = computed(() => tutorialMode.value ? tutorialVideoUrl.value : videoUrl.value)
  const displayVideoAutoplay = computed(() => tutorialMode.value ? false : videoAutoplay.value)

  const workoutTimeline = computed(() => buildVisualWorkoutTimeline(arrangement.value?.items ?? []))
  const emptyWorkoutState: VisualWorkoutState = {
    current: {
      id: 'loading',
      kind: 'preview',
      slot: 'preview',
      itemIndex: 0,
      actionNumber: 1,
      totalActions: 1,
      title: '准备训练',
      coachCue: '正在加载动作编排',
      startSeconds: 0,
      endSeconds: 1
    },
    next: null,
    phaseNumber: 1,
    totalPhases: 1,
    actionNumber: 1,
    totalActions: 1,
    remainingSeconds: 1,
    phaseElapsedSeconds: 0,
    sessionElapsedSeconds: 0,
    phaseProgressPercent: 0,
    sessionProgressPercent: 0
  }
  const workoutState = computed(() => workoutTimeline.value.length > 0
    ? resolveVisualWorkoutState(workoutTimeline.value, sessionProgressSeconds.value, {
        itemIndex: activeItemIndex.value,
        slot: phaseSlot.value
      })
    : emptyWorkoutState
  )
  const workoutTimelineReady = computed(() => workoutTimeline.value.length > 0)
  const canComplete = computed(() => (
    videoEnded.value
    && Boolean(videoUrl.value)
    && !videoError.value
    && !videoLoading.value
    && !completing.value
  ))
  const completionHint = computed(() => {
    if (videoLoading.value) return '正在加载教学视频'
    if (videoError.value) return videoError.value
    if (!videoUrl.value) return '当前训练暂未配置教学视频'
    if (completionError.value) return completionError.value
    if (!trainingStarted.value) return '准备好后点击“开始训练”'
    if (!recognitionEnabled.value) return '请先开启相机，识别动作后再开始训练'
    if (startCountdown.value > 0) return `${startCountdown.value} 秒后开始准备`
    if (phaseKind.value === 'preview') return `${phaseRemainingSeconds.value} 秒后开始 ${exerciseVideo.value?.title ?? '动作'}`
    if (phaseKind.value === 'demonstration') return `正在进行预训练：${exerciseVideo.value?.title ?? '动作'}`
    if (phaseKind.value === 'countdown') {
      return phaseSlot.value === 'pretraining-countdown'
        ? `${phaseRemainingSeconds.value} 秒后开始预训练示范`
        : `${phaseRemainingSeconds.value} 秒后开始正式训练`
    }
    if (!videoEnded.value) return `动作 ${activeItemIndex.value + 1}/${arrangement.value?.items.length ?? 0}，正式训练中`
    if (completing.value) return '正在保存训练记录'
    return '教学视频已完成，可以提交训练'
  })

  function clearRecordTimer() {
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
  }

  function clearPhaseTimer() {
    phaseClockGeneration += 1
    if (phaseTimer) {
      clearTimeout(phaseTimer)
      phaseTimer = null
    }
    phaseDeadlineMs = null
  }

  function clearMediaStartWatchdog() {
    if (mediaStartWatchdogTimer) {
      clearTimeout(mediaStartWatchdogTimer)
      mediaStartWatchdogTimer = null
    }
  }

  function discardCurrentCachedVideo() {
    const sourceUrl = sourceVideoUrl.value
    if (!sourceUrl || videoUrl.value === sourceUrl) return false
    const nextCachedPaths = { ...cachedVideoPaths.value }
    delete nextCachedPaths[sourceUrl]
    cachedVideoPaths.value = nextCachedPaths
    void trainingVideoCache.evict(sourceUrl)
    return true
  }

  function scheduleMediaStartWatchdog() {
    clearMediaStartWatchdog()
    const generation = videoPhaseGeneration.value
    const recoveryPhase = `${activeItem.value?.id ?? 0}:${phaseSlot.value}`
    if (mediaStartRecoveryPhase !== recoveryPhase) {
      mediaStartRecoveryPhase = recoveryPhase
      mediaStartRecoveryAttempts = 0
    }
    mediaStartWatchdogTimer = setTimeout(() => {
      mediaStartWatchdogTimer = null
      const playablePhase = (
        phaseKind.value === 'active'
        || (
          phaseKind.value === 'demonstration'
          && phaseSlot.value === 'pretraining'
          && resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'FULL'
        )
      )
      if (
        generation !== videoPhaseGeneration.value
        || !trainingStarted.value
        || !videoAutoplay.value
        || playbackState.value === 'playing'
        || !playablePhase
      ) return

      // Recovery may replace/replay the native video, but the configured
      // workout clock and both audio tracks remain authoritative. A delayed
      // media start must never stretch a ten-second phase beyond ten seconds.

      // A persisted file can pass getSavedFileInfo but still never start in
      // the native video layer. Retry the current action from CDN once before
      // asking the user to intervene.
      if (discardCurrentCachedVideo()) {
        console.warn('[VisualSession:media]', {
          event: 'cached-video-start-timeout',
          itemIndex: activeItemIndex.value,
          itemId: activeItem.value?.id,
          phase: phaseSlot.value,
          expectedToken: videoEventToken.value
        })
        videoPhaseGeneration.value += 1
        playbackState.value = 'idle'
        scheduleMediaStartWatchdog()
        return
      }

      // Native video contexts occasionally ignore the first programmatic
      // play after a source/slot hand-off without emitting an error event.
      // Rotate the event generation so the panel re-seeks and replays the
      // visible slot once before surfacing a blocking error.
      if (mediaStartRecoveryAttempts < 1) {
        mediaStartRecoveryAttempts += 1
        console.warn('[VisualSession:media]', {
          event: 'video-start-retry',
          attempt: mediaStartRecoveryAttempts,
          itemIndex: activeItemIndex.value,
          itemId: activeItem.value?.id,
          phase: phaseSlot.value,
          expectedToken: videoEventToken.value
        })
        videoPhaseGeneration.value += 1
        playbackState.value = 'idle'
        scheduleMediaStartWatchdog()
        return
      }

      console.error('[VisualSession:media]', {
        event: 'video-start-timeout',
        itemIndex: activeItemIndex.value,
        itemId: activeItem.value?.id,
        phase: phaseSlot.value,
        expectedToken: videoEventToken.value,
        videoUrl: videoUrl.value,
        playbackState: playbackState.value
      })
      videoAutoplay.value = false
      playbackState.value = 'idle'
      videoError.value = '教学视频未能开始播放，请重试'
    }, mediaStartWatchdogMs)
  }

  function clearStartCountdownTimer() {
    if (startCountdownTimer) {
      clearInterval(startCountdownTimer)
      startCountdownTimer = null
    }
    startCountdownDeadlineMs = null
  }

  function clearCacheWarmupTimer() {
    if (cacheWarmupTimer) {
      clearTimeout(cacheWarmupTimer)
      cacheWarmupTimer = null
    }
  }

  function invalidateModuleTransition() {
    moduleTransitionGeneration += 1
    moduleTransitionInFlight = false
  }

  function syncSessionProgress() {
    const phase = workoutTimeline.value.find(item => (
      item.itemIndex === activeItemIndex.value && item.slot === phaseSlot.value
    ))
    if (!phase) return

    const phaseDuration = phase.endSeconds - phase.startSeconds
    const elapsed = Math.max(0, phaseDuration - phaseRemainingExactSeconds)
    sessionProgressSeconds.value = phase.startSeconds + elapsed
  }

  function setPhaseRemaining(seconds: number) {
    phaseRemainingExactSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
    phaseRemainingSeconds.value = Math.ceil(phaseRemainingExactSeconds)
    syncSessionProgress()
  }

  function updatePhaseClock(generation: number) {
    if (generation !== phaseClockGeneration || phaseDeadlineMs === null) return false
    const remaining = Math.max(0, (phaseDeadlineMs - clockNowMs()) / 1000)
    phaseRemainingExactSeconds = remaining
    phaseRemainingSeconds.value = Math.ceil(remaining)
    syncSessionProgress()
    return remaining <= 0
  }

  function activeSpeechPhase(slot: TrainingAudioPhaseSlot) {
    return resolveTrainingAudioPhasePlan(trainingAudioPlan, activeItem.value?.id, slot)
  }

  function playCountdownSequence(
    preserveIntoFollowingModule: boolean,
    phase: TrainingTtsPhase,
    preserveCurrentPlayback = false
  ) {
    const slot = phase === 'PRETRAINING'
      ? 'pretraining-countdown'
      : 'formal-countdown'
    const cues = activeSpeechPhase(slot)?.cues ?? []
    preserveStartCountdownAudio = preserveIntoFollowingModule && cues.length > 0
    // The complete countdown sequence was arranged after the API response;
    // start its immutable phase clock now instead of polling from the UI timer.
    if (preserveCurrentPlayback) ttsPlayer.resetTimeline()
    else ttsPlayer.reset()
    ttsPlayer.schedule(cues)
  }

  function continueAfterModuleAudio(audioUrls: readonly string[], onComplete: () => void) {
    if (moduleTransitionInFlight) return
    moduleTransitionInFlight = true
    const generation = ++moduleTransitionGeneration
    const completionAudio = ttsPlayer.enqueue(audioUrls)
    void (async () => {
      try {
        await Promise.all([completionAudio, ttsPlayer.waitForIdle()])
      } catch (error) {
        console.warn('[VisualSession:TTS] module hand-off failed:', error)
      }
      if (generation !== moduleTransitionGeneration) return
      moduleTransitionInFlight = false
      onComplete()
    })()
  }

  function finishCountdown(onComplete: () => void) {
    // The configured deadline is authoritative. The final countdown cue may
    // finish over the first instant of the next phase, where the speech queue
    // remains serialized, but it cannot extend the countdown itself.
    countdownAudioPending.value = false
    onComplete()
  }

  function nextItemStartsWithCountdown(item: ExerciseArrangementItem | null) {
    if (!item) return false
    if (resolvePretrainingMode(item.pretraining_mode) !== 'NONE') {
      return resolveCountdownDuration(item.pretraining_countdown_duration) > 0
    }
    return resolveCountdownDuration(item.formal_countdown_duration) > 0
  }

  function pretrainingGuidanceCues() {
    return activeSpeechPhase('pretraining')?.cues ?? []
  }

  function formalGuidanceCues() {
    return activeSpeechPhase('formal-training')?.cues ?? []
  }

  function startConfiguredMediaGuidance(elapsedSeconds = 0) {
    if (phaseKind.value !== 'demonstration' && phaseKind.value !== 'active') return
    const itemId = activeItem.value?.id
    if (!itemId) return
    const token = `${videoPhaseGeneration.value}:${phaseSlot.value}:${itemId}`
    if (startedMediaGuidanceToken === token) return
    startedMediaGuidanceToken = token

    ttsPlayer.schedule(
      phaseKind.value === 'demonstration'
        ? pretrainingGuidanceCues()
        : formalGuidanceCues(),
      elapsedSeconds
    )
    const duration = phaseKind.value === 'demonstration'
      ? resolvePretrainingDuration(activeItem.value)
      : Math.max(1, activeItem.value?.expected_duration ?? 1)
    trainingSoundscape.play(
      phaseKind.value === 'demonstration' ? 'pretraining' : 'formal',
      duration,
      elapsedSeconds
    )
  }

  function startConfiguredPhaseClock() {
    if (
      !trainingStarted.value
      || phaseTimer
    ) return

    if (
      phaseKind.value === 'demonstration'
      && phaseSlot.value === 'pretraining'
      && resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'FULL'
    ) {
      startPhaseTimer(finishPretraining)
      return
    }

    if (phaseKind.value === 'active' && phaseSlot.value === 'formal-training') {
      startPhaseTimer(beginNextItem)
    }
  }

  function startPhaseTimer(onComplete: () => void) {
    clearPhaseTimer()
    const duration = phaseRemainingExactSeconds > 0
      ? phaseRemainingExactSeconds
      : Math.max(0, phaseRemainingSeconds.value)
    if (duration <= 0) {
      onComplete()
      return
    }

    const generation = phaseClockGeneration
    phaseDeadlineMs = clockNowMs() + duration * 1000
    const scheduleNextTick = () => {
      if (generation !== phaseClockGeneration || phaseDeadlineMs === null) return
      const now = clockNowMs()
      phaseTimer = setTimeout(tick, resolveNextWholeSecondDelayMs(phaseDeadlineMs, now))
    }
    const tick = () => {
      phaseTimer = null
      if (updatePhaseClock(generation)) {
        clearPhaseTimer()
        onComplete()
        return
      }
      scheduleNextTick()
    }
    updatePhaseClock(generation)
    scheduleNextTick()
  }

  function pausePhaseTimer() {
    if (phaseDeadlineMs !== null) {
      updatePhaseClock(phaseClockGeneration)
    }
    clearPhaseTimer()
  }

  function startConfiguredMediaPhase() {
    // The configured phase begins when the app enters it, not when WeChat
    // eventually reports that the native video has started. Scheduling both
    // audio tracks and the phase clock from this same boundary prevents a
    // slow media event from leaving audio pending after the visible timer has
    // reached its end.
    startConfiguredMediaGuidance()
    startConfiguredPhaseClock()
  }

  function resumeTimerDrivenPhase() {
    if (!trainingStarted.value || sessionSuspended || sessionStopping || phaseTimer) return
    if (phaseKind.value === 'countdown') {
      if (phaseSlot.value === 'pretraining-countdown') {
        startPhaseTimer(() => finishCountdown(beginPretraining))
      } else if (phaseSlot.value === 'formal-countdown') {
        startPhaseTimer(() => finishCountdown(beginFormalTraining))
      }
      return
    }
    if (
      phaseKind.value === 'demonstration'
      && phaseSlot.value === 'pretraining'
      && resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'FIRST_FRAME'
    ) {
      startPhaseTimer(finishPretraining)
      return
    }
    startConfiguredPhaseClock()
  }

  function suspendSession() {
    if (disposed || sessionSuspended) return
    sessionSuspended = true
    resumeVideoOnShow = videoAutoplay.value
    pausePhaseTimer()
    clearMediaStartWatchdog()
    videoAutoplay.value = false
    trainingAudioClock.suspend()
    ttsPlayer.suspend()
    trainingSoundscape.suspend()
    capture.value?.stopDetect?.()
  }

  function resumeSession() {
    if (disposed || !sessionSuspended || sessionStopping) return
    sessionSuspended = false
    trainingAudioClock.resume()
    capture.value?.startDetect?.()
    ttsPlayer.resume()
    trainingSoundscape.resume()
    if (resumeVideoOnShow && trainingStarted.value && !videoEnded.value) {
      videoAutoplay.value = true
      scheduleMediaStartWatchdog()
    }
    resumeTimerDrivenPhase()
    if (!trainingStarted.value && !tutorialMode.value && recognitionReady.value) {
      void startTraining()
    }
    resumeVideoOnShow = false
  }

  function rememberCachedVideo(url: string, filePath: string, itemIndex: number) {
    if (
      activeItemIndex.value === itemIndex &&
      (phaseKind.value === 'active' || phaseKind.value === 'demonstration') &&
      videoUrl.value !== filePath
    ) {
      // Never replace the media element after a playable phase has begun.
      // The async prefetch for the next action can otherwise remount the
      // current video during pretraining and desynchronize its TTS/timer.
      return
    }
    cachedVideoPaths.value = {
      ...cachedVideoPaths.value,
      [url]: filePath
    }
  }

  async function restoreCachedVideo(itemIndex: number) {
    const requestId = videoRequestId
    const item = arrangement.value?.items?.[itemIndex]
    const sourceUrl = item?.video.video_file?.trim()
    if (!sourceUrl) return

    const filePath = await trainingVideoCache.get(sourceUrl)
    if (!filePath || requestId !== videoRequestId) return
    rememberCachedVideo(sourceUrl, filePath, itemIndex)
  }

  async function prefetchVideoWindow(itemIndex: number) {
    const requestId = videoRequestId
    const items = arrangement.value?.items ?? []
    const windowItems = items.slice(itemIndex, itemIndex + 2)
    const prefetchItem = (item: (typeof windowItems)[number], offset: number) => {
      const sourceUrl = item.video.video_file?.trim()
      if (!sourceUrl) return Promise.resolve()
      return trainingVideoCache.prefetch(sourceUrl).then(filePath => {
        if (!filePath || requestId !== videoRequestId) return
        rememberCachedVideo(sourceUrl, filePath, itemIndex + offset)
      })
    }

    if (!windowItems[0]) return
    await prefetchItem(windowItems[0], 0)
    windowItems.slice(1).forEach((item, offset) => {
      void prefetchItem(item, offset + 1)
    })
  }

  function scheduleVideoPrefetch(itemIndex: number) {
    clearCacheWarmupTimer()
    const requestId = videoRequestId
    cacheWarmupTimer = setTimeout(() => {
      cacheWarmupTimer = null
      if (requestId !== videoRequestId) return
      void prefetchVideoWindow(itemIndex)
    }, 600)
  }

  function recordScoringWarning(message: string) {
    if (scoringWarnings.value.includes(message)) return
    scoringWarnings.value = [...scoringWarnings.value, message]
  }

  async function preloadActionStandards(
    nextArrangement: ExerciseArrangementDetail,
    requestId: number
  ) {
    const loaded = await mapWithConcurrency(nextArrangement.items, async item => {
      const url = resolveStandardUrl(item)
      if (!url) {
        return {
          item,
          error: `${item.video.title}未配置标准动作文件。`
        } as const
      }

      try {
        return {
          item,
          standard: await actionStandardLoader.load(
            url,
            item.video.standard_asset_etag
          )
        } as const
      } catch (error) {
        const detail = error instanceof Error ? error.message : '标准动作文件加载失败。'
        return {
          item,
          error: `${item.video.title}无法评分：${detail}`
        } as const
      }
    }, ACTION_STANDARD_PRELOAD_CONCURRENCY)
    if (requestId !== videoRequestId) return

    const standards: Record<number, ActionStandard> = {}
    loaded.forEach(result => {
      if ('standard' in result && result.standard) {
        standards[result.item.id] = result.standard
      } else {
        recordScoringWarning(result.error)
      }
    })
    actionStandards.value = standards

  }

  function preloadTrainingTts(nextArrangement: ExerciseArrangementDetail) {
    // Arrange every reachable speech phase once while the tutorial is visible.
    // Runtime phase entry only starts an already-built immutable timeline.
    trainingAudioPlan = buildTrainingAudioPlan(nextArrangement)
    return Promise.all([
      ttsPlayer.preload(trainingAudioPlan.speechAudioUrls),
      trainingSoundscape.preload()
    ]).then(() => undefined)
  }

  function finalizeActiveAction() {
    if (phaseKind.value !== 'active') return
    acceptingPoseFrames = false
    const item = activeItem.value
    const frames = currentActionFrames.value
    currentActionFrames.value = []
    if (!item) return
    actionPoseSegments.value = [
      ...actionPoseSegments.value.filter(segment => segment.itemId !== item.id),
      {
        itemId: item.id,
        videoId: item.video_id,
        frames: [...frames]
      }
    ]

    const standard = actionStandards.value[item.id]
    if (!standard) {
      recordScoringWarning(`${item.video.title}缺少有效标准动作，已跳过评分。`)
      return
    }
    const motion = buildActionMotion(frames)
    if (!motion) {
      const warning = `${item.video.title}未采集到有效姿态角度，本动作记为 0 分。`
      recordScoringWarning(warning)
      // Preserve the missing action as a zero inside a partially scored
      // session. If every action is missing, the session remains unscored.
      actionScores.value = [
        ...actionScores.value.filter(action => action.itemId !== item.id),
        buildMissingPoseActionResult(item, standard, frames.length)
      ]
      return
    }

    try {
      const result = scoreAction(standard, motion, {
        alignmentMethod: 'dtw',
        coarseAlignment: true,
        smoothingWindow: 3
      })
      const scoredAction: ScoredActionResult = {
        itemId: item.id,
        videoId: item.video_id,
        actionId: standard.action_id,
        title: item.video.title,
        expectedDuration: item.expected_duration,
        score: toRoundedScore(result.score),
        passed: result.passed,
        feedback: result.feedback,
        angleDetails: result.angle_details,
        frameCount: frames.length
      }
      actionScores.value = [
        ...actionScores.value.filter(action => action.itemId !== item.id),
        scoredAction
      ]
    } catch (error) {
      const detail = error instanceof Error ? error.message : '评分计算失败。'
      recordScoringWarning(`${item.video.title}无法评分：${detail}`)
    }
  }

  function beginFormalTraining() {
    clearPhaseTimer()
    countdownAudioPending.value = false
    videoPhaseGeneration.value += 1
    startedMediaGuidanceToken = ''
    currentActionFrames.value = []
    acceptingPoseFrames = true
    activeActionStartedAtMs = Date.now()
    phaseKind.value = 'active'
    phaseSlot.value = 'formal-training'
    const formalDuration = Math.max(1, activeItem.value?.expected_duration ?? 1)
    trainingSoundscape.finish()
    setPhaseRemaining(formalDuration)
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = exerciseVideo.value?.duration ?? 0
    playbackState.value = 'idle'
    videoAutoplay.value = true
    console.info('[VisualSession:timeline]', {
      event: 'formal-training-entered',
      itemIndex: activeItemIndex.value,
      itemId: activeItem.value?.id,
      expectedDuration: phaseRemainingExactSeconds,
      videoGeneration: videoPhaseGeneration.value
    })
    scheduleMediaStartWatchdog()
    const keepTrailingModuleGuidance = preserveTrailingModuleGuidance
    preserveTrailingModuleGuidance = false
    // Keep the action-level 3-2-1 sequence intact when it crosses the phase
    // boundary. All other transitions still clear their stale prompts.
    if (preserveStartCountdownAudio) {
      preserveStartCountdownAudio = false
      ttsPlayer.cancelPendingPlayback()
      ttsPlayer.resetTimeline()
    } else if (keepTrailingModuleGuidance) {
      // The document can place a "next action" cue in the final seconds of
      // formal training. Let a cue already playing finish under the next
      // module while start guidance for that module queues behind it.
    } else {
      ttsPlayer.reset()
    }
    syncSessionProgress()
    startConfiguredMediaPhase()
  }

  function beginFormalCountdownOrTraining() {
    clearPhaseTimer()
    clearMediaStartWatchdog()
    videoPhaseGeneration.value += 1
    const countdownDuration = resolveCountdownDuration(
      activeItem.value?.formal_countdown_duration
    )
    if (countdownDuration <= 0) {
      beginFormalTraining()
      return
    }

    const keepTrailingModuleGuidance = preserveTrailingModuleGuidance
    preserveTrailingModuleGuidance = false
    phaseKind.value = 'countdown'
    phaseSlot.value = 'formal-countdown'
    trainingSoundscape.finish()
    setPhaseRemaining(countdownDuration)
    playbackState.value = 'idle'
    videoAutoplay.value = false
    playCountdownSequence(true, 'FORMAL', keepTrailingModuleGuidance)
    startPhaseTimer(() => finishCountdown(beginFormalTraining))
  }

  function finishPretraining() {
    if (
      phaseKind.value !== 'demonstration'
      || phaseSlot.value !== 'pretraining'
      || moduleTransitionInFlight
    ) return

    clearPhaseTimer()
    clearMediaStartWatchdog()
    // At the configured boundary, cancel only future events from the old
    // phase. A cue already playing and the configured COMPLETE cue may finish
    // over the next phase, but neither may delay the 15.000s transition.
    ttsPlayer.advanceTimeline()
    const completionAudioUrls = activeSpeechPhase('pretraining')
      ?.completionAudioUrls ?? []
    void ttsPlayer.enqueue(completionAudioUrls)
    preserveTrailingModuleGuidance = true
    videoAutoplay.value = false
    playbackState.value = 'idle'
    beginFormalCountdownOrTraining()
  }

  function beginPretraining() {
    clearPhaseTimer()
    clearStartCountdownTimer()
    countdownAudioPending.value = false
    videoPhaseGeneration.value += 1
    startedMediaGuidanceToken = ''
    const keepCountdownAudio = preserveStartCountdownAudio
    const keepTrailingModuleGuidance = preserveTrailingModuleGuidance
    preserveStartCountdownAudio = false
    preserveTrailingModuleGuidance = false

    if (resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'NONE') {
      beginFormalCountdownOrTraining()
      return
    }

    videoError.value = ''
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = Math.max(1, exerciseVideo.value?.duration ?? 1)
    phaseKind.value = 'demonstration'
    phaseSlot.value = 'pretraining'
    trainingSoundscape.finish()
    setPhaseRemaining(resolvePretrainingDuration(activeItem.value))
    playbackState.value = 'idle'
    const pretrainingMode = resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL')
    videoAutoplay.value = pretrainingMode === 'FULL'
    if (videoAutoplay.value) scheduleMediaStartWatchdog()
    if (keepCountdownAudio) {
      ttsPlayer.cancelPendingPlayback()
      ttsPlayer.resetTimeline()
    } else if (keepTrailingModuleGuidance) {
      // `beginNextItem` has already discarded stale queued cues. Do not stop
      // the one document-timed cue that is intentionally crossing this
      // boundary into the next pretraining module.
    } else {
      ttsPlayer.reset()
    }
    if (pretrainingMode === 'FIRST_FRAME') {
      ttsPlayer.schedule(pretrainingGuidanceCues())
      trainingSoundscape.play('pretraining', resolvePretrainingDuration(activeItem.value))
      startPhaseTimer(finishPretraining)
    } else {
      startConfiguredMediaPhase()
    }
  }

  function beginPretrainingCountdownOrPretraining() {
    clearPhaseTimer()
    clearMediaStartWatchdog()
    videoPhaseGeneration.value += 1
    if (resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'NONE') {
      beginFormalCountdownOrTraining()
      return
    }
    const countdownDuration = resolveCountdownDuration(
      activeItem.value?.pretraining_countdown_duration
    )
    if (countdownDuration <= 0) {
      beginPretraining()
      return
    }

    const keepTrailingModuleGuidance = preserveTrailingModuleGuidance
    preserveTrailingModuleGuidance = false
    phaseKind.value = 'countdown'
    phaseSlot.value = 'pretraining-countdown'
    trainingSoundscape.finish()
    setPhaseRemaining(countdownDuration)
    playbackState.value = 'idle'
    videoAutoplay.value = false
    playCountdownSequence(true, 'PRETRAINING', keepTrailingModuleGuidance)
    startPhaseTimer(() => finishCountdown(beginPretraining))
  }

  async function startTraining() {
    // Real devices begin a Web Audio context suspended. Resume it in the
    // start interaction before every TTS/soundscape timeline is scheduled.
    trainingAudioClock.resume()
    if (disposed || sessionStopping || sessionSuspended) return
    if (!recognitionReady.value) {
      if (typeof uni.showToast === 'function') {
        void uni.showToast({
          title: recognitionStatus.value === 'failed'
            ? '相机准备失败，请退出后重试'
            : '正在准备相机，请稍候',
          icon: 'none'
        })
      }
      return
    }

    if (
      trainingStarted.value
      || preparingTraining.value
      || !arrangement.value
      || !videoUrl.value
      || videoLoading.value
      || videoError.value
    ) return

    const requestedArrangement = arrangement.value
    const requestId = videoRequestId
    const videoId = primaryVideoId.value
    if (!videoId) {
      videoError.value = '训练动作配置不完整'
      return
    }
    preparingTraining.value = true
    trainingPreparationLabel.value = '正在加载动作与语音资源…'
    try {
      // Standards are prepared in the background while the tutorial is
      // visible. Wait here, at the actual scoring boundary, so a slow JSON
      // CDN cannot block the first demonstration from rendering.
      await Promise.all([standardsReadyPromise, ttsReadyPromise])
      if (disposed || sessionStopping || sessionSuspended || requestId !== videoRequestId || arrangement.value !== requestedArrangement) return
      trainingPreparationLabel.value = '正在创建训练记录…'
      await submission.prepare({
        modality: options.modality.value,
        videoId,
        arrangementId: requestedArrangement.id,
        arrangementFingerprint: requestedArrangement.configuration_fingerprint
      })
      if (disposed || sessionStopping || sessionSuspended || requestId !== videoRequestId || arrangement.value !== requestedArrangement) return
    } catch (error) {
      reportBackendSyncError('训练会话准备', error)
      return
    } finally {
      preparingTraining.value = false
      trainingPreparationLabel.value = ''
    }

    trainingStarted.value = true
    startCountdown.value = 0
    beginFirstAction()
  }

  function beginFirstAction() {
    invalidateModuleTransition()
    clearStartCountdownTimer()
    clearPhaseTimer()
    clearMediaStartWatchdog()
    activeItemIndex.value = 0
    beginPretrainingCountdownOrPretraining()
  }

  function beginNextItem() {
    if (phaseKind.value !== 'active' || moduleTransitionInFlight) return
    console.info('[VisualSession:timeline]', {
      event: 'formal-training-completed',
      itemIndex: activeItemIndex.value,
      itemId: activeItem.value?.id,
      videoGeneration: videoPhaseGeneration.value
    })
    finalizeActiveAction()
    const formalCompletionAudioUrls = activeSpeechPhase('formal-training')
      ?.completionAudioUrls ?? []
    const isLastItem = activeItemIndex.value >= (arrangement.value?.items?.length ?? 0) - 1
    trainingSoundscape.finish(isLastItem)
    clearPhaseTimer()
    clearMediaStartWatchdog()
    ttsPlayer.advanceTimeline()
    const completionAudio = ttsPlayer.enqueue(formalCompletionAudioUrls)
    if (isLastItem) {
      videoAutoplay.value = false
      videoEnded.value = true
      playbackState.value = 'ended'
      sessionProgressSeconds.value = workoutTimeline.value.at(-1)?.endSeconds ?? 0
      void finishSessionAfterPlayback(Promise.all([
        completionAudio,
        ttsPlayer.waitForIdle()
      ]).then(() => undefined))
      return
    }

    activeItemIndex.value += 1
    videoPhaseGeneration.value += 1
    console.info('[VisualSession:timeline]', {
      event: 'action-advanced',
      itemIndex: activeItemIndex.value,
      itemId: activeItem.value?.id,
      videoGeneration: videoPhaseGeneration.value
    })
    startedMediaGuidanceToken = ''
    playbackState.value = 'idle'
    videoAutoplay.value = false
    void prefetchVideoWindow(activeItemIndex.value)
    syncSessionProgress()
    preserveTrailingModuleGuidance = true
    beginPretrainingCountdownOrPretraining()
  }

  async function stopRecording() {
    clearRecordTimer()
    if (!recording.value) return

    recording.value = false
    try {
      const stopPromise = capture.value?.stopRecord() ?? Promise.resolve('')
      recordedVideoPath.value = await settleWithin(stopPromise, recordingStopTimeoutMs, '')
    } catch (error) {
      console.warn('[VisualSession] stopRecord failed:', error)
    }
  }

  async function loadExerciseArrangement() {
    const requestId = ++videoRequestId
    videoLoading.value = true
    videoError.value = ''
    videoEnded.value = false
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = 0
    sessionProgressSeconds.value = 0
    activeItemIndex.value = 0
    cachedVideoPaths.value = {}
    phaseKind.value = 'preview'
    phaseSlot.value = 'preview'
    trainingSoundscape.stop()
    countdownAudioPending.value = false
    phaseRemainingExactSeconds = initialPreviewDurationSeconds
    phaseRemainingSeconds.value = initialPreviewDurationSeconds
    trainingStarted.value = false
    startCountdown.value = 0
    videoAutoplay.value = false
    playbackState.value = 'idle'
    completionError.value = ''
    poseAngleFrames.value = []
    currentActionFrames.value = []
    actionPoseSegments.value = []
    actionStandards.value = {}
    actionScores.value = []
    scoringWarnings.value = []
    // The page must never flash the follow-along layout before guidance data
    // finishes loading.
    tutorialMode.value = true
    tutorialIndex.value = 0
    tutorialText.value = ''
    tutorialRecords.value = []
    tutorialVideoUrlOverride.value = ''
    tutorialRequestId += 1
    practiceStartPending = false
    preserveStartCountdownAudio = false
    preserveTrailingModuleGuidance = false
    startedMediaGuidanceToken = ''
    clearPhaseTimer()
    clearMediaStartWatchdog()
    clearStartCountdownTimer()
    clearCacheWarmupTimer()
    ttsPlayer.reset()
    standardsReadyPromise = null
    ttsReadyPromise = null
    trainingAudioPlan = null
    arrangement.value = null

    try {
      const nextArrangement = await studentBackendSync.loadVisualExerciseArrangement(
        options.modality.value,
        options.arrangementId.value ?? undefined
      )
      if (requestId !== videoRequestId) return

      arrangement.value = nextArrangement
      videoDurationSeconds.value = exerciseVideo.value?.duration ?? 0
      if (!nextArrangement || !exerciseVideo.value?.video_file?.trim()) {
        videoError.value = '当前训练暂未配置可播放的动作编排'
      } else {
        // TTS must warm during the tutorial, rather than after all scoring
        // standards finish downloading, so a quick transition cannot lose
        // the first configured countdown or later module prompt.
        ttsReadyPromise = preloadTrainingTts(nextArrangement)
        standardsReadyPromise = preloadActionStandards(nextArrangement, requestId)
        phaseRemainingExactSeconds = initialPreviewDurationSeconds
        phaseRemainingSeconds.value = initialPreviewDurationSeconds
        syncSessionProgress()
        await restoreCachedVideo(0)
        scheduleVideoPrefetch(0)
        tutorialIndex.value = 0
        // Tutorial text and history are optional. Do not keep the training
        // controls unavailable while that secondary request is in flight.
        void loadTutorialData(0)
      }
    } catch (error) {
      if (requestId !== videoRequestId) return
      videoError.value = '教学视频加载失败，请检查网络后重试'
      reportBackendSyncError('教学视频加载', error)
    } finally {
      if (requestId === videoRequestId) {
        videoLoading.value = false
      }
    }
  }

  function retryVideo() {
    if (trainingStarted.value && sourceVideoUrl.value) {
      discardCurrentCachedVideo()
      videoPhaseGeneration.value += 1
      videoError.value = ''
      videoEnded.value = false
      playbackState.value = 'idle'
      const playablePhase = phaseKind.value === 'active' || (
        phaseKind.value === 'demonstration'
        && phaseSlot.value === 'pretraining'
        && resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'FULL'
      )
      videoAutoplay.value = playablePhase
      if (playablePhase) scheduleMediaStartWatchdog()
      return
    }

    // Resume the shared clock inside the user-initiated start path. Every
    // configured deadline below is measured from this AudioContext timeline.
    trainingAudioClock.resume()
    void loadExerciseArrangement()
  }

  // ── Tutorial functions ──
  async function loadTutorialData(index: number) {
    const item = arrangement.value?.items?.[index]
    if (!item) return

    const requestId = ++tutorialRequestId
    const initialTutorialText = item.video.tutorial_text?.trim() ?? ''

    // Use tutorial_text from the arrangement item if available, otherwise fetch from API
    tutorialText.value = initialTutorialText

    tutorialRecords.value = []
    tutorialVideoUrlOverride.value = ''
    tutorialLoading.value = true
    try {
      const loadTutorial = studentBackendSync.loadExerciseVideoTutorial
      if (typeof loadTutorial !== 'function') return

      const resp = await loadTutorial(item.video_id)
      const isCurrentTutorial = requestId === tutorialRequestId
        && tutorialMode.value
        && tutorialIndex.value === index
        && arrangement.value?.items?.[index]?.video_id === item.video_id
      if (!isCurrentTutorial || !resp || resp.video_id !== item.video_id) return

      if (resp) {
        if (!initialTutorialText && resp.tutorial_text) {
          tutorialText.value = resp.tutorial_text
        }
        tutorialRecords.value = resp.recent_records ?? []
        tutorialVideoUrlOverride.value = resp.tutorial_video_url?.trim() ?? ''
      }
    } catch (error) {
      // Tutorial API is optional - silently ignore errors
      if (requestId === tutorialRequestId) {
        console.warn('[VisualSession] tutorial load failed:', error)
      }
    } finally {
      if (requestId === tutorialRequestId) {
        tutorialLoading.value = false
      }
    }
  }

  async function nextTutorial() {
    if (tutorialIsLast.value) return
    tutorialIndex.value += 1
    await loadTutorialData(tutorialIndex.value)
  }

  async function prevTutorial() {
    if (tutorialIndex.value <= 0) return
    tutorialIndex.value -= 1
    await loadTutorialData(tutorialIndex.value)
  }

  function startPractice() {
    // Exit tutorial mode and start the practice session
    tutorialMode.value = false
    activeItemIndex.value = 0
    requestPracticeStart()
  }

  function skipTutorial() {
    // Skip directly to practice without watching all tutorials
    tutorialMode.value = false
    activeItemIndex.value = 0
    requestPracticeStart()
  }

  function requestPracticeStart() {
    practiceStartPending = true
    // The pose view is deliberately unmounted in tutorial mode. Always wait
    // for the fresh instance to report readiness rather than trusting a stale
    // ready state from an earlier mount.
    recognitionStatus.value = 'preparing'
    recognitionEnabled.value = true
  }


  function isCurrentVideoEvent(event: unknown, eventName: string) {
    const envelope = readVideoEvent(event)
    const matches = envelope.token
      ? envelope.token === videoEventToken.value
      : Boolean(envelope.elementId && envelope.elementId === videoElementId.value)
    if (!matches) {
      console.warn('[VisualSession:timeline]', {
        event: 'stale-video-event-rejected',
        eventName,
        receivedToken: envelope.token,
        expectedToken: videoEventToken.value,
        receivedElementId: envelope.elementId,
        expectedElementId: videoElementId.value,
        itemIndex: activeItemIndex.value,
        phase: phaseSlot.value
      })
    }
    return matches
  }

  function handleVideoTimeUpdate(event: unknown) {
    if (
      (phaseKind.value !== 'active' && phaseKind.value !== 'demonstration')
      || !isCurrentVideoEvent(event, 'timeupdate')
    ) return
    const currentTime = readVideoEvent(event).detail?.currentTime
    const duration = readVideoEvent(event).detail?.duration
    if (typeof currentTime === 'number' && Number.isFinite(currentTime)) {
      videoProgressSeconds.value = currentTime
    }
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      videoDurationSeconds.value = duration
    }
    if (sessionSuspended) return
    // A positive progress update proves that native playback has recovered,
    // but it never starts, pauses or changes the configured phase/audio clock.
    if (
      typeof currentTime === 'number'
      && Number.isFinite(currentTime)
      && currentTime > 0
    ) {
      // WeChat can resume media after buffering without emitting a second
      // native `play` event. A progressing timeupdate is proof that playback
      // has resumed, so clear the transient buffering pause before restarting
      // the authoritative phase clock.
      playbackState.value = 'playing'
      clearMediaStartWatchdog()
    }
    // Speech uses the same pause/resume clock as the phase timer; native
    // timeupdate cadence must never determine cue precision.
  }

  function handleVideoPlay(event?: unknown) {
    if (!isCurrentVideoEvent(event, 'play')) return
    if (!trainingStarted.value || videoEnded.value || !videoAutoplay.value) return
    playbackState.value = 'playing'
    mediaStartRecoveryAttempts = 0
    clearMediaStartWatchdog()
  }

  function handleVideoPause(event?: unknown) {
    if (!isCurrentVideoEvent(event, 'pause') || playbackState.value === 'ended') return
    // A module hand-off deliberately pauses the demonstration video before
    // its COMPLETE prompt. That programmatic pause must not cancel the prompt
    // which is responsible for deciding when the next module may begin.
    if (moduleTransitionInFlight) return
    const isPlayablePretraining = (
      phaseKind.value === 'demonstration'
      && phaseSlot.value === 'pretraining'
      && resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'FULL'
    )
    if (phaseKind.value !== 'active' && !isPlayablePretraining) return
    if (sessionSuspended) {
      playbackState.value = 'paused'
      return
    }
    // Native media recovery is independent from the pre-arranged workout
    // timeline. Keep the timer and both audio tracks advancing while the
    // panel asks the video layer to resume.
    playbackState.value = 'paused'
    if (videoAutoplay.value) scheduleMediaStartWatchdog()
  }

  function handleVideoWaiting(event?: unknown) {
    if (!isCurrentVideoEvent(event, 'waiting') || playbackState.value === 'ended') return
    const isPlayablePretraining = (
      phaseKind.value === 'demonstration'
      && phaseSlot.value === 'pretraining'
      && resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'FULL'
    )
    if (phaseKind.value !== 'active' && !isPlayablePretraining) return
    // Buffering must not stretch configured action durations or introduce
    // cumulative drift into either pre-arranged audio track.
    playbackState.value = 'paused'
    if (videoAutoplay.value) scheduleMediaStartWatchdog()
  }

  function handleVideoEnded(event?: unknown) {
    if (!isCurrentVideoEvent(event, 'ended')) return
    clearMediaStartWatchdog()
    const detail = readVideoEvent(event).detail
    const finalTime = detail?.currentTime ?? detail?.duration
    if (typeof finalTime === 'number' && Number.isFinite(finalTime)) {
      videoProgressSeconds.value = finalTime
    }
    // The native video loops in the panel. `ended` is telemetry only; it has
    // no authority to start or finish a configured phase.
  }

  function handleVideoError(event?: unknown) {
    if (!isCurrentVideoEvent(event, 'error')) return
    // Keep the configured phase/audio clocks running while the video source
    // is recovered. The video layer is never allowed to determine duration.
    const sourceUrl = sourceVideoUrl.value
    if (sourceUrl && videoUrl.value !== sourceUrl) {
      discardCurrentCachedVideo()
      videoError.value = ''
      videoEnded.value = false
      playbackState.value = 'idle'
      if (videoAutoplay.value) scheduleMediaStartWatchdog()
      return
    }
    clearMediaStartWatchdog()
    videoEnded.value = false
    playbackState.value = 'idle'
    videoError.value = '教学视频播放失败，请重试后再完成训练'
  }

  function startRecognition(fps: 5 | 10) {
    recognitionFps.value = fps
    livePoseFps.value = 0
    poseFallbackSampling.value = false
    recognitionStatus.value = 'preparing'
    recognitionEnabled.value = true
  }

  async function toggleRecord() {
    if (recording.value) {
      await stopRecording()
      return
    }

    if (!recognitionEnabled.value || !capture.value) {
      return
    }

    recordSeconds.value = 0
    recordedVideoPath.value = ''
    try {
      await capture.value.startRecord()
      recording.value = true
      recordTimer = setInterval(() => {
        recordSeconds.value += 1
      }, 1000)
    } catch (error) {
      console.warn('[VisualSession] startRecord failed:', error)
    }
  }

  function handlePoseResult(result: DetectResult) {
    if (
      phaseKind.value !== 'active'
      || !acceptingPoseFrames
      || !result.angleFrame
      || (
        result.angleFrame.tsMs > 1_000_000_000_000
        && result.angleFrame.tsMs < activeActionStartedAtMs
      )
    ) return
    if (poseAngleFrames.value.length >= maxPoseAngleFrames) return

    poseAngleFrames.value.push(result.angleFrame)
    currentActionFrames.value.push(result.angleFrame)
  }

  function handlePoseStats(stats: { status: string; fps: number }) {
    if (stats.status === 'ready') {
      recognitionStatus.value = 'ready'
      if (practiceStartPending) {
        practiceStartPending = false
        startTraining()
      }
    } else if (stats.status === 'failed') {
      recognitionStatus.value = 'failed'
      practiceStartPending = false
    }
    poseFallbackSampling.value = stats.status === 'sampling' || stats.status === 'sampling-fallback'
    if (stats.fps > 0) {
      livePoseFps.value = stats.fps
    }
  }

  async function finishSessionAfterPlayback(completionAudio?: Promise<void>) {
    if (completing.value) return
    if (!canComplete.value) {
      if (typeof uni.showToast === 'function') {
        void uni.showToast({ title: completionHint.value, icon: 'none' })
      }
      return
    }

    completing.value = true
    completionError.value = ''
    await stopRecording()
    const completedAt = new Date().toISOString()

    const durationSeconds = Math.max(
      1,
      Math.round(
        workoutTimeline.value.at(-1)?.endSeconds
          ?? arrangement.value?.total_duration
          ?? videoProgressSeconds.value
          ?? 0
      )
    )
    const scoring = buildSessionScoringResult(
      actionScores.value,
      scoringWarnings.value,
      arrangement.value?.items.map(item => item.id) ?? []
    )
    const basePoseAnalysis = buildVisualPoseAnalysisPayload(
      sampleActionPoseSegmentsForUpload(actionPoseSegments.value)
    )
    const poseAnalysis = basePoseAnalysis
      ? {
          ...basePoseAnalysis,
          scoringSource: 'client' as const,
          scoringVersion: ACTION_SCORING_VERSION,
          actionScores: actionScores.value,
          scoringWarnings: scoringWarnings.value,
          ...(scoring.scoreDetails ? { scoreDetails: scoring.scoreDetails } : {})
        }
      : undefined
    let qualityScore = scoring.score === undefined ? null : Math.round(scoring.score)
    let summary = scoring.summary
    const scoreUnavailableReason = scoring.scoreUnavailableReason

    if (resultStored) {
      await navigateAfterResult()
      return
    }

    try {
      const result = await submission.sync({
        modality: options.modality.value,
        durationSeconds,
        ...(primaryVideoId.value
          ? { videoId: primaryVideoId.value }
          : {}),
        ...(scoring.score !== undefined ? { score: scoring.score } : {}),
        ...(scoreUnavailableReason ? { scoreUnavailableReason } : {}),
        comment: scoring.summary,
        completedAt,
        scoreAlgorithmVersion: ACTION_SCORING_VERSION,
        clientVersion: '0.1.0',
        actionResults: actionScores.value,
        ...(poseAnalysis ? { poseAnalysis } : {})
      })
      if (disposed || sessionStopping) return

      if (result.synced && result.record) {
        qualityScore = result.record.score === null || result.record.score === undefined
          ? null
          : toScore(result.record.score)
        summary = result.record.comment?.trim() || (
          result.record.score !== null && result.record.score !== undefined
            ? `教学视频已完成，动作评分 ${qualityScore} 分。`
            : summary
        )
      }
    } catch (error) {
      console.error('[VisualSession:submission]', {
        sessionId: submission.sessionId,
        durationSeconds,
        score: scoring.score,
        actionResultCount: actionScores.value.length,
        uploadedPoseFrameCount: basePoseAnalysis?.frames.length ?? 0
      })
      reportBackendSyncError('训练记录同步', error)
      completionError.value = formatBackendErrorMessage(
        error,
        '训练结果提交失败，请检查网络后重试'
      )
      completing.value = false
      return
    }

    store.completeTrainingSession({
      sessionId: submission.sessionId,
      modality: options.modality.value,
      qualityScore,
      summary,
      capturedBy: 'camera',
      completedAt,
      countsAsCompletion: scoring.score !== undefined,
      scoreDetails: scoring.scoreDetails ?? null
    })
    useTrainingProgress().invalidate()
    invalidateGrowthOverview()
    resultStored = true
    resultCountsAsCompletion = scoring.score !== undefined

    await completionAudio
    if (disposed || sessionStopping) return
    await navigateAfterResult()
  }

  async function navigateAfterResult() {
    if (resultCountsAsCompletion) {
      await navigateToShortQuestionnaire()
      return
    }
    completing.value = true
    completionError.value = ''
    try {
      await Promise.resolve(uni.redirectTo({
        url: `/pages/training/feedback?sessionId=${encodeURIComponent(submission.sessionId)}`
      }))
    } catch (error) {
      reportBackendSyncError('训练反馈跳转', error)
      completionError.value = '训练结果已保存，请点击继续查看结果'
      completing.value = false
    }
  }

  async function navigateToShortQuestionnaire() {
    completing.value = true
    completionError.value = ''
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (error?: unknown) => {
          if (settled) return
          settled = true
          if (error) reject(error)
          else resolve()
        }
        const navigationResult = uni.redirectTo({
          url: `/pages/training/short-questionnaire?sessionId=${encodeURIComponent(submission.sessionId)}`,
          success: () => finish(),
          fail: error => finish(error)
        }) as unknown
        if (
          navigationResult
          && typeof navigationResult === 'object'
          && 'then' in navigationResult
          && typeof (navigationResult as PromiseLike<void>).then === 'function'
        ) {
          void Promise.resolve(navigationResult).then(() => finish(), finish)
        }
      })
      if (disposed || sessionStopping) return
    } catch (error) {
      reportBackendSyncError('训练问卷跳转', error)
      completionError.value = '训练结果已保存，请点击继续填写问卷'
      completing.value = false
    }
  }

  async function finishSession() {
    return finishSessionAfterPlayback()
  }

  function haltActiveSession() {
    if (sessionStopping) return
    sessionStopping = true
    acceptingPoseFrames = false
    resumeVideoOnShow = false
    trainingStarted.value = false
    videoAutoplay.value = false
    videoRequestId += 1
    tutorialRequestId += 1
    invalidateModuleTransition()
    clearPhaseTimer()
    clearMediaStartWatchdog()
    clearStartCountdownTimer()
    ttsPlayer.reset()
    trainingSoundscape.stop()
    capture.value?.stopDetect?.()
  }

  async function interruptSession() {
    haltActiveSession()
    await stopRecording()
    try {
      await Promise.resolve(uni.switchTab({ url: '/pages/training/select' }))
    } catch (error) {
      reportBackendSyncError('退出训练', error)
    }
  }

  async function requestExitSession() {
    if (!trainingStarted.value || videoEnded.value || sessionStopping) {
      await interruptSession()
      return
    }
    if (typeof uni.showModal !== 'function') {
      await interruptSession()
      return
    }
    try {
      const result = await uni.showModal({
        title: '退出本次训练？',
        content: '当前训练进度不会保存。',
        confirmText: '退出训练',
        cancelText: '继续训练'
      })
      if (result.confirm) await interruptSession()
    } catch (error) {
      reportBackendSyncError('退出训练确认', error)
    }
  }

  watch([options.modality, options.arrangementId], () => {
    invalidateModuleTransition()
    void stopRecording()
    recognitionEnabled.value = false
    recognitionStatus.value = 'idle'
    poseAngleFrames.value = []
    currentActionFrames.value = []
    actionPoseSegments.value = []
    actionStandards.value = {}
    actionScores.value = []
    scoringWarnings.value = []
    ttsPlayer.reset()
    trainingSoundscape.stop()
    clearStartCountdownTimer()
    void loadExerciseArrangement()
  }, { immediate: true })

  function disposeSession() {
    if (disposed) return
    disposed = true
    sessionStopping = true
    acceptingPoseFrames = false
    videoRequestId += 1
    tutorialRequestId += 1
    invalidateModuleTransition()
    clearRecordTimer()
    clearPhaseTimer()
    clearMediaStartWatchdog()
    clearStartCountdownTimer()
    clearCacheWarmupTimer()
    ttsPlayer.destroy()
    trainingSoundscape.destroy?.()
    trainingAudioClock.close()
    if (recording.value) {
      recording.value = false
      void capture.value?.stopRecord().catch(() => {})
    }
    capture.value?.stopDetect?.()
  }

  onBeforeUnmount(disposeSession)

  return {
    capture,
    arrangement,
    exerciseVideo,
    videoLoading,
    videoError,
    videoEnded,
    videoProgressSeconds,
    videoUrl,
    nextVideoUrl,
    videoResetKey,
    videoEventToken,
    videoElementId,
    recording,
    recordSeconds,
    recordedVideoPath,
    recognitionEnabled,
    recognitionReady,
    recognitionStatus,
    recognitionFps,
    livePoseFps,
    poseFallbackSampling,
    completing,
    completionError,
    canComplete,
    completionHint,
    workoutState,
    workoutTimelineReady,
    playbackState,
    videoAutoplay,
    trainingStarted,
    preparingTraining,
    trainingPreparationLabel,
    startCountdown,
    phaseKind,
    phaseSlot,
    phaseRemainingSeconds,
    countdownAudioPending,
    // Tutorial exports
    tutorialMode,
    tutorialIndex,
    tutorialText,
    tutorialRecords,
    tutorialLoading,
    tutorialItem,
    tutorialVideo,
    tutorialVideoUrl,
    tutorialTotalActions,
    tutorialIsLast,
    displayVideoUrl,
    displayVideoAutoplay,
    nextTutorial,
    prevTutorial,
    startPractice,
    skipTutorial,
    retryVideo,
    handleVideoTimeUpdate,
    handleVideoPlay,
    handleVideoPause,
    handleVideoWaiting,
    handleVideoEnded,
    handleVideoError,
    startRecognition,
    startTraining,
    toggleRecord,
    handlePoseResult,
    handlePoseStats,
    finishSession,
    interruptSession,
    requestExitSession,
    suspendSession,
    resumeSession,
    disposeSession
  }
}
