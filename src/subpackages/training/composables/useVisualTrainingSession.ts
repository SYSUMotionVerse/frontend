// The visual-session controller is loaded only with the training subpackage.
import { computed, onBeforeUnmount, shallowRef, watch, type ShallowRef } from 'vue'
import type { TrainingModality } from '../../../domain/student/types'
import type {
  ExerciseArrangementDetail,
  ExerciseArrangementItem,
  ExerciseRecordBrief,
  ExerciseScoreDetails,
  ExerciseVideoSummary,
  TutorialResponse
} from '../../../uni-app/api/studentBackendTypes'
import { buildVisualPoseAnalysisPayload, studentBackendSync } from '../../../uni-app/api/studentBackend'
import { reportBackendSyncError } from '../../../uni-app/api/reportBackendSyncError'
import type { DetectResult } from '../components/pose/PoseDetectModel'
import type { PoseAngleFrame } from '../../../uni-app/components/pose/poseAnalysis'
import { useStudentStore } from '../../../uni-app/composables/useStudentStore'
import { useVisualTrainingSubmission } from '../../../uni-app/composables/useVisualTrainingSubmission'
import { invalidateGrowthOverview } from '../../../uni-app/composables/useGrowthOverview'
import { useTrainingProgress } from '../../../uni-app/composables/useTrainingProgress'
import { trainingVideoCache } from '../../../uni-app/platform/videoCache'
import { actionStandardLoader } from '../../../uni-app/platform/actionStandardLoader'
import { createTrainingTtsPlayer } from '../../../uni-app/platform/trainingTts'
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
  resolvePretrainingMode,
  resolveVisualWorkoutState,
  type VisualTrainingPlaybackState,
  type VisualWorkoutPhaseKind,
  type VisualWorkoutPhaseSlot,
  type VisualWorkoutState
} from '../../../features/training/visualWorkoutTimeline'
import {
  resolveArrangementTtsAudioUrls,
  resolveTrainingCountdownAudioUrls,
  resolveTrainingCountdownTtsCues,
  resolveTrainingRestCountdownTtsCues,
  resolveTrainingPhaseCompletionAudioUrls,
  resolveTrainingPhaseDelayedTtsCues,
  resolveTrainingPhaseStartAudioUrls,
  resolveTrainingPhaseTtsCues
} from '../../../features/training/trainingTtsConfig'

export interface VisualTrainingCaptureApi {
  startRecord: () => Promise<void>
  stopRecord: () => Promise<string>
}

interface UseVisualTrainingSessionOptions {
  modality: ShallowRef<Exclude<TrainingModality, 'stair'>>
}

type PoseRecognitionStatus = 'idle' | 'preparing' | 'ready' | 'failed'

const maxPoseAngleFrames = 18_000

interface VisualVideoEventEnvelope {
  token?: string
  detail?: {
    currentTime?: number
    duration?: number
  }
}

function readVideoEvent(event: unknown): VisualVideoEventEnvelope {
  if (!event || typeof event !== 'object') return {}
  const value = event as Record<string, unknown>
  if ('token' in value || 'detail' in value) {
    return {
      token: typeof value.token === 'string' ? value.token : undefined,
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

function buildSessionScoringResult(
  actionScores: ScoredActionResult[],
  scoringWarnings: string[]
) {
  const aggregate = aggregateActionScores(actionScores, scoringWarnings)
  if (aggregate.score === undefined) {
    return {
      score: undefined,
      summary: aggregate.summary,
      scoreDetails: undefined
    }
  }
  const scoreDetails: ExerciseScoreDetails = {
    overallScore: aggregate.score,
    summary: aggregate.summary,
    dimensions: aggregate.dimensions,
    highlights: aggregate.highlights,
    warnings: aggregate.warnings,
    chartSnapshot: {
      radar: aggregate.dimensions
    }
  }

  return { score: aggregate.score, summary: aggregate.summary, scoreDetails }
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
  const tutorialMode = shallowRef(false)
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
  const actionStandards = shallowRef<Record<number, ActionStandard>>({})
  const actionScores = shallowRef<ScoredActionResult[]>([])
  const scoringWarnings = shallowRef<string[]>([])
  const ttsPlayer = createTrainingTtsPlayer()
  let pendingEndCue: Promise<void> | undefined
  let recordTimer: ReturnType<typeof setInterval> | null = null
  let phaseTimer: ReturnType<typeof setInterval> | null = null
  let startCountdownTimer: ReturnType<typeof setInterval> | null = null
  let cacheWarmupTimer: ReturnType<typeof setTimeout> | null = null
  let videoRequestId = 0
  let tutorialRequestId = 0
  let videoPhaseGeneration = 0
  let phaseClockGeneration = 0
  let phaseDeadlineMs: number | null = null
  let phaseRemainingExactSeconds = 0
  let startCountdownDeadlineMs: number | null = null
  let practiceStartPending = false
  let preserveStartCountdownAudio = false
  let startedMediaGuidanceToken = ''

  function clockNowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  }

  const activeItem = computed(() => arrangement.value?.items?.[activeItemIndex.value] ?? null)
  const primaryVideoId = computed(() => arrangement.value?.items?.[0]?.video_id)
  const exerciseVideo = computed<ExerciseVideoSummary | null>(() => activeItem.value?.video ?? null)
  const sourceVideoUrl = computed(() => exerciseVideo.value?.video_file?.trim() ?? '')
  const videoUrl = computed(() => cachedVideoPaths.value[sourceVideoUrl.value] ?? sourceVideoUrl.value)
  const videoEventToken = computed(() => (
    `${videoPhaseGeneration}:${phaseSlot.value}:${activeItemIndex.value}:${videoUrl.value}`
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
      endSeconds: 1,
      countdownDuration: 0
    },
    next: null,
    phaseNumber: 1,
    totalPhases: 1,
    actionNumber: 1,
    totalActions: 1,
    remainingSeconds: 1,
    phaseProgressPercent: 0,
    sessionProgressPercent: 0
  }
  const workoutState = computed(() => workoutTimeline.value.length > 0
    ? resolveVisualWorkoutState(workoutTimeline.value, sessionProgressSeconds.value)
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
    if (phaseKind.value === 'demonstration') return `正在完整预训练示范：${exerciseVideo.value?.title ?? '动作'}`
    if (phaseKind.value === 'rest') return `休息 ${phaseRemainingSeconds.value} 秒，准备下一动作`
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
      clearInterval(phaseTimer)
      phaseTimer = null
    }
    phaseDeadlineMs = null
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
    syncTimedTrainingGuidance()
    return remaining <= 0
  }

  function playCountdownSequence(
    duration: number,
    preserveIntoFormalTraining = false
  ) {
    const cues = resolveTrainingCountdownTtsCues(
      arrangement.value?.countdown_tts_cues,
      duration
    )
    preserveStartCountdownAudio = preserveIntoFormalTraining && cues.length > 0
    // The clock synchronizes the 3/2/1 speech at its actual remaining-second
    // boundary. Clearing here prevents a prompt from a previous module from
    // leaking into a newly displayed countdown.
    ttsPlayer.reset()
  }

  function pretrainingGuidanceCues() {
    return resolveTrainingPhaseTtsCues(activeItem.value, 'PRETRAINING', {
      phaseDurationSeconds: Math.max(1, videoDurationSeconds.value)
    })
  }

  function formalGuidanceCues() {
    return resolveTrainingPhaseTtsCues(activeItem.value, 'FORMAL', {
      phaseDurationSeconds: Math.max(1, activeItem.value?.expected_duration ?? 1)
    })
  }

  function restGuidanceCues() {
    // A rest module belongs to the action that just completed. The active
    // index already points at the next action while that module is visible.
    const completedItem = arrangement.value?.items?.[activeItemIndex.value - 1]
    const restDuration = Math.max(0, completedItem?.rest_duration ?? 0)
    return resolveTrainingPhaseTtsCues(completedItem, 'REST', {
      phaseDurationSeconds: restDuration,
      countdownDurationSeconds: Math.min(
        restDuration,
        resolveCountdownDuration(completedItem?.rest_countdown_duration)
      )
    })
  }

  function restCountdownGuidanceCues() {
    const completedItem = arrangement.value?.items?.[activeItemIndex.value - 1]
    const hasEmbeddedCountdown = (completedItem?.training_tts_cues ?? []).some(cue => (
      cue.phase === 'REST'
      && cue.includes_embedded_countdown === true
      && cue.text.trim().length > 0
      && cue.audio_url.trim().length > 0
    ))
    if (hasEmbeddedCountdown) return []
    return resolveTrainingRestCountdownTtsCues(
      arrangement.value?.countdown_tts_cues,
      completedItem?.rest_duration ?? 0,
      completedItem?.rest_countdown_duration ?? 0
    )
  }

  function queuePhaseStartGuidance(cues: ReturnType<typeof pretrainingGuidanceCues>, prefixUrls: string[] = []) {
    const audioUrls = [
      ...prefixUrls,
      ...resolveTrainingPhaseStartAudioUrls(cues)
    ]
    if (audioUrls.length > 0) ttsPlayer.enqueue(audioUrls)
  }

  function startMediaGuidanceAfterNativePlay() {
    if (phaseKind.value !== 'demonstration' && phaseKind.value !== 'active') return
    const itemId = activeItem.value?.id
    if (!itemId) return
    const token = `${videoPhaseGeneration}:${phaseSlot.value}:${itemId}`
    if (startedMediaGuidanceToken === token) return
    startedMediaGuidanceToken = token

    queuePhaseStartGuidance(
      phaseKind.value === 'demonstration'
        ? pretrainingGuidanceCues()
        : formalGuidanceCues()
    )
  }

  function syncDemonstrationGuidance(currentTime: number) {
    if (phaseKind.value !== 'demonstration' || phaseSlot.value !== 'pretraining') return
    ttsPlayer.sync(
      resolveTrainingPhaseDelayedTtsCues(pretrainingGuidanceCues()),
      Math.max(0, currentTime)
    )
  }

  function syncTimedTrainingGuidance() {
    if (phaseKind.value === 'countdown') {
      const duration = phaseSlot.value === 'pretraining-countdown'
        ? resolveCountdownDuration(activeItem.value?.pretraining_countdown_duration)
        : resolveCountdownDuration(activeItem.value?.formal_countdown_duration)
      ttsPlayer.sync(
        resolveTrainingCountdownTtsCues(arrangement.value?.countdown_tts_cues, duration),
        Math.max(0, duration - phaseRemainingExactSeconds)
      )
      return
    }

    if (phaseKind.value === 'active' && phaseSlot.value === 'formal-training') {
      const duration = Math.max(1, activeItem.value?.expected_duration ?? 1)
      ttsPlayer.sync(
        resolveTrainingPhaseDelayedTtsCues(formalGuidanceCues()),
        Math.max(0, duration - phaseRemainingExactSeconds)
      )
      return
    }

    if (phaseKind.value === 'rest' && phaseSlot.value === 'rest') {
      const previousItem = arrangement.value?.items?.[activeItemIndex.value - 1]
      const duration = Math.max(0, previousItem?.rest_duration ?? 0)
      ttsPlayer.sync(
        [
          ...resolveTrainingPhaseDelayedTtsCues(restGuidanceCues()),
          ...restCountdownGuidanceCues()
        ],
        Math.max(0, duration - phaseRemainingExactSeconds)
      )
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
    const tick = () => {
      if (!updatePhaseClock(generation)) return
      clearPhaseTimer()
      onComplete()
    }
    tick()
    if (phaseDeadlineMs !== null) {
      phaseTimer = setInterval(tick, 200)
    }
  }

  function pausePhaseTimer() {
    if (phaseDeadlineMs !== null) {
      updatePhaseClock(phaseClockGeneration)
    }
    clearPhaseTimer()
  }

  function rememberCachedVideo(url: string, filePath: string, itemIndex: number) {
    if (
      activeItemIndex.value === itemIndex &&
      phaseKind.value === 'active' &&
      videoUrl.value !== filePath
    ) {
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
    const loaded = await Promise.all(nextArrangement.items.map(async item => {
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
          standard: await actionStandardLoader.load(url)
        } as const
      } catch (error) {
        const detail = error instanceof Error ? error.message : '标准动作文件加载失败。'
        return {
          item,
          error: `${item.video.title}无法评分：${detail}`
        } as const
      }
    }))
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

    const firstAudioUrls = [
      ...resolveTrainingCountdownAudioUrls(nextArrangement.countdown_tts_cues, 3),
      ...resolveArrangementTtsAudioUrls(nextArrangement.items.slice(0, 1))
    ]
    await ttsPlayer.preload(firstAudioUrls)
    const laterAudioUrls = resolveArrangementTtsAudioUrls(nextArrangement.items.slice(1))
    void ttsPlayer.preload(laterAudioUrls)
  }

  function finalizeActiveAction() {
    if (phaseKind.value !== 'active') return
    const item = activeItem.value
    const frames = currentActionFrames.value
    currentActionFrames.value = []
    if (!item) return

    const standard = actionStandards.value[item.id]
    if (!standard) {
      recordScoringWarning(`${item.video.title}缺少有效标准动作，已跳过评分。`)
      return
    }
    const motion = buildActionMotion(frames)
    if (!motion) {
      recordScoringWarning(`${item.video.title}未采集到有效姿态角度，已跳过评分。`)
      return
    }

    try {
      const result = scoreAction(standard, motion, { alignmentMethod: 'dtw' })
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
    videoPhaseGeneration += 1
    startedMediaGuidanceToken = ''
    currentActionFrames.value = []
    phaseKind.value = 'active'
    phaseSlot.value = 'formal-training'
    setPhaseRemaining(Math.max(1, activeItem.value?.expected_duration ?? 1))
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = exerciseVideo.value?.duration ?? 0
    playbackState.value = 'idle'
    videoAutoplay.value = true
    // Keep the action-level 3-2-1 sequence intact when it crosses the phase
    // boundary. All other transitions still clear their stale prompts.
    if (preserveStartCountdownAudio) {
      preserveStartCountdownAudio = false
      ttsPlayer.resetTimeline()
    } else {
      ttsPlayer.reset()
    }
    pendingEndCue = undefined
    syncSessionProgress()
  }

  function beginFormalCountdownOrTraining() {
    clearPhaseTimer()
    videoPhaseGeneration += 1
    const countdownDuration = resolveCountdownDuration(
      activeItem.value?.formal_countdown_duration
    )
    if (countdownDuration <= 0) {
      beginFormalTraining()
      return
    }

    phaseKind.value = 'countdown'
    phaseSlot.value = 'formal-countdown'
    setPhaseRemaining(countdownDuration)
    playbackState.value = 'idle'
    videoAutoplay.value = false
    playCountdownSequence(countdownDuration, true)
    startPhaseTimer(beginFormalTraining)
  }

  function beginPretraining() {
    clearPhaseTimer()
    clearStartCountdownTimer()
    videoPhaseGeneration += 1
    startedMediaGuidanceToken = ''
    preserveStartCountdownAudio = false

    if (resolvePretrainingMode(activeItem.value?.pretraining_mode ?? 'FULL') === 'NONE') {
      beginFormalCountdownOrTraining()
      return
    }

    videoError.value = ''
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = Math.max(
      1,
      exerciseVideo.value?.duration ?? activeItem.value?.expected_duration ?? 1
    )
    phaseKind.value = 'demonstration'
    phaseSlot.value = 'pretraining'
    setPhaseRemaining(videoDurationSeconds.value)
    playbackState.value = 'idle'
    videoAutoplay.value = true
    ttsPlayer.reset()
  }

  function beginPretrainingCountdownOrPretraining() {
    clearPhaseTimer()
    videoPhaseGeneration += 1
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

    phaseKind.value = 'countdown'
    phaseSlot.value = 'pretraining-countdown'
    setPhaseRemaining(countdownDuration)
    playbackState.value = 'idle'
    videoAutoplay.value = false
    playCountdownSequence(countdownDuration)
    startPhaseTimer(beginPretraining)
  }

  async function startTraining() {
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

    const videoId = primaryVideoId.value
    if (!videoId) {
      videoError.value = '训练动作配置不完整'
      return
    }
    preparingTraining.value = true
    try {
      await submission.prepare({
        modality: options.modality.value,
        videoId,
        arrangementId: arrangement.value.id,
        arrangementFingerprint: arrangement.value.configuration_fingerprint
      })
    } catch (error) {
      reportBackendSyncError('训练会话准备', error)
      return
    } finally {
      preparingTraining.value = false
    }

    trainingStarted.value = true
    startCountdown.value = 0
    beginFirstAction()
  }

  function beginFirstAction() {
    clearStartCountdownTimer()
    clearPhaseTimer()
    activeItemIndex.value = 0
    beginPretrainingCountdownOrPretraining()
  }

  function beginRestOrNextItem() {
    finalizeActiveAction()
    const completedItem = activeItem.value
    const formalCompletionAudioUrls = resolveTrainingPhaseCompletionAudioUrls(
      completedItem,
      'FORMAL'
    )
    const isLastItem = activeItemIndex.value >= (arrangement.value?.items?.length ?? 0) - 1
    if (isLastItem) {
      videoAutoplay.value = false
      videoEnded.value = true
      playbackState.value = 'ended'
      sessionProgressSeconds.value = workoutTimeline.value.at(-1)?.endSeconds ?? 0
      ttsPlayer.reset()
      pendingEndCue = ttsPlayer.enqueue(formalCompletionAudioUrls)
      void finishSessionAfterPlayback(pendingEndCue)
      return
    }

    activeItemIndex.value += 1
    videoPhaseGeneration += 1
    startedMediaGuidanceToken = ''
    phaseKind.value = 'rest'
    phaseSlot.value = 'rest'
    const previousItem = arrangement.value?.items?.[activeItemIndex.value - 1]
    const restDuration = Math.max(0, previousItem?.rest_duration ?? 0)
    setPhaseRemaining(restDuration)
    playbackState.value = 'idle'
    videoAutoplay.value = false
    void prefetchVideoWindow(activeItemIndex.value)
    syncSessionProgress()
    if (phaseRemainingExactSeconds <= 0) {
      ttsPlayer.reset()
      beginPretrainingCountdownOrPretraining()
      return
    }
    ttsPlayer.reset()
    queuePhaseStartGuidance(restGuidanceCues(), formalCompletionAudioUrls)
    startPhaseTimer(() => {
      beginPretrainingCountdownOrPretraining()
    })
  }

  async function stopRecording() {
    clearRecordTimer()
    if (!recording.value) return

    recording.value = false
    try {
      recordedVideoPath.value = await capture.value?.stopRecord() ?? ''
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
    phaseRemainingExactSeconds = initialPreviewDurationSeconds
    phaseRemainingSeconds.value = initialPreviewDurationSeconds
    trainingStarted.value = false
    startCountdown.value = 0
    videoAutoplay.value = false
    playbackState.value = 'idle'
    completionError.value = ''
    poseAngleFrames.value = []
    currentActionFrames.value = []
    actionStandards.value = {}
    actionScores.value = []
    scoringWarnings.value = []
    // Reset tutorial state
    tutorialMode.value = false
    tutorialIndex.value = 0
    tutorialText.value = ''
    tutorialRecords.value = []
    tutorialVideoUrlOverride.value = ''
    tutorialRequestId += 1
    practiceStartPending = false
    preserveStartCountdownAudio = false
    startedMediaGuidanceToken = ''
    clearPhaseTimer()
    clearStartCountdownTimer()
    clearCacheWarmupTimer()
    arrangement.value = null

    try {
      const nextArrangement = await studentBackendSync.loadVisualExerciseArrangement(options.modality.value)
      if (requestId !== videoRequestId) return

      arrangement.value = nextArrangement
      videoDurationSeconds.value = exerciseVideo.value?.duration ?? 0
      if (!nextArrangement || !exerciseVideo.value?.video_file?.trim()) {
        videoError.value = '当前训练暂未配置可播放的动作编排'
      } else {
        await preloadActionStandards(nextArrangement, requestId)
        if (requestId !== videoRequestId) return
        phaseRemainingExactSeconds = initialPreviewDurationSeconds
        phaseRemainingSeconds.value = initialPreviewDurationSeconds
        syncSessionProgress()
        await restoreCachedVideo(0)
        scheduleVideoPrefetch(0)
        // Enter tutorial mode after arrangement loads
        tutorialMode.value = true
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


  function isCurrentVideoEvent(event: unknown) {
    const envelope = readVideoEvent(event)
    return envelope.token === videoEventToken.value
  }

  function handleVideoTimeUpdate(event: unknown) {
    if (
      (phaseKind.value !== 'active' && phaseKind.value !== 'demonstration')
      || !isCurrentVideoEvent(event)
    ) return
    const currentTime = readVideoEvent(event).detail?.currentTime
    const duration = readVideoEvent(event).detail?.duration
    if (typeof currentTime === 'number' && Number.isFinite(currentTime)) {
      videoProgressSeconds.value = currentTime
    }
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      videoDurationSeconds.value = duration
    }
    if (
      phaseKind.value === 'demonstration'
      && typeof currentTime === 'number'
      && Number.isFinite(currentTime)
    ) {
      setPhaseRemaining(Math.max(0, videoDurationSeconds.value - currentTime))
      // Pretraining guidance follows the actual native media position. Formal
      // and rest prompts use their own backend-configured module timelines.
      syncDemonstrationGuidance(currentTime)
    }
  }

  function handleVideoPlay(event?: unknown) {
    if (!isCurrentVideoEvent(event)) return
    if (!trainingStarted.value || videoEnded.value || !videoAutoplay.value) return
    playbackState.value = 'playing'
    // This native event is the first point at which demonstration/formal
    // speech may begin. It prevents a slow video load from causing TTS to
    // speak before the matching media is actually visible.
    startMediaGuidanceAfterNativePlay()
    if (phaseKind.value === 'active' && !phaseTimer) {
      // The action clock starts at the native play event, not when the Vue
      // state flips to autoplay. Network/seek latency therefore cannot eat
      // into the configured expected duration.
      startPhaseTimer(beginRestOrNextItem)
    }
  }

  function handleVideoPause(event?: unknown) {
    if (!isCurrentVideoEvent(event) || playbackState.value === 'ended') return
    if (phaseKind.value !== 'active' && phaseKind.value !== 'demonstration') return
    if (phaseKind.value === 'active') pausePhaseTimer()
    ttsPlayer.pause()
    playbackState.value = 'paused'
  }

  function handleVideoWaiting(event?: unknown) {
    if (!isCurrentVideoEvent(event) || playbackState.value === 'ended') return
    if (phaseKind.value !== 'active' && phaseKind.value !== 'demonstration') return
    if (phaseKind.value === 'active') pausePhaseTimer()
    ttsPlayer.pause()
    playbackState.value = 'paused'
  }

  function togglePlayback() {
    if (
      !trainingStarted.value
      || startCountdown.value > 0
      || videoEnded.value
      || completing.value
      || videoError.value
      || phaseKind.value === 'rest'
      || phaseKind.value === 'countdown'
    ) return

    videoAutoplay.value = !videoAutoplay.value
    if (!videoAutoplay.value) {
      pausePhaseTimer()
      ttsPlayer.pause()
      playbackState.value = 'paused'
    } else {
      playbackState.value = 'idle'
    }
  }

  function handleVideoEnded(event?: unknown) {
    if (!isCurrentVideoEvent(event)) return
    const detail = readVideoEvent(event).detail
    const finalTime = detail?.currentTime ?? detail?.duration
    if (typeof finalTime === 'number' && Number.isFinite(finalTime)) {
      videoProgressSeconds.value = finalTime
    }
    if (phaseKind.value === 'demonstration' && phaseSlot.value === 'pretraining') {
      beginFormalCountdownOrTraining()
      return
    }
    if (phaseKind.value !== 'active') return
    // Active videos are looped by the panel. A native `ended` event is not a
    // completion signal; the expected-duration clock is the sole transition
    // authority. If a platform emits ended before play, start that clock now.
    if (!phaseTimer && videoAutoplay.value) {
      playbackState.value = 'playing'
      startPhaseTimer(beginRestOrNextItem)
    }
  }

  function handleVideoError(event?: unknown) {
    if (!isCurrentVideoEvent(event)) return
    const sourceUrl = sourceVideoUrl.value
    if (sourceUrl && videoUrl.value !== sourceUrl) {
      const nextCachedPaths = { ...cachedVideoPaths.value }
      delete nextCachedPaths[sourceUrl]
      cachedVideoPaths.value = nextCachedPaths
      void trainingVideoCache.evict(sourceUrl)
      videoError.value = ''
      videoEnded.value = false
      playbackState.value = 'idle'
      return
    }
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
    if (phaseKind.value !== 'active' || !result.angleFrame) return
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
    const scoring = buildSessionScoringResult(actionScores.value, scoringWarnings.value)
    const basePoseAnalysis = buildVisualPoseAnalysisPayload(poseAngleFrames.value)
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
    const scoreUnavailableReason = scoring.score === undefined
      ? (scoringWarnings.value.join('; ') || 'no_valid_action_score')
      : undefined

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
      reportBackendSyncError('训练记录同步', error)
      completionError.value = '训练结果提交失败，请检查网络后重试'
      completing.value = false
      return
    }

    store.completeTrainingSession({
      sessionId: submission.sessionId,
      modality: options.modality.value,
      qualityScore,
      summary,
      capturedBy: 'camera'
    })
    useTrainingProgress().invalidate()
    invalidateGrowthOverview()

    await completionAudio
    void uni.redirectTo({
      url: `/pages/training/short-questionnaire?sessionId=${encodeURIComponent(submission.sessionId)}`
    })
  }

  async function finishSession() {
    return finishSessionAfterPlayback()
  }

  async function interruptSession() {
    await stopRecording()
    void uni.redirectTo({ url: '/pages/training/select' })
  }

  watch(options.modality, () => {
    void stopRecording()
    recognitionEnabled.value = false
    recognitionStatus.value = 'idle'
    poseAngleFrames.value = []
    currentActionFrames.value = []
    actionStandards.value = {}
    actionScores.value = []
    scoringWarnings.value = []
    ttsPlayer.reset()
    clearStartCountdownTimer()
    void loadExerciseArrangement()
  }, { immediate: true })

  onBeforeUnmount(() => {
    videoRequestId += 1
    clearRecordTimer()
    clearPhaseTimer()
    clearStartCountdownTimer()
    clearCacheWarmupTimer()
    ttsPlayer.destroy()
    if (recording.value) {
      recording.value = false
      void capture.value?.stopRecord().catch(() => {})
    }
  })

  return {
    capture,
    arrangement,
    exerciseVideo,
    videoLoading,
    videoError,
    videoEnded,
    videoUrl,
    videoEventToken,
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
    startCountdown,
    phaseKind,
    phaseSlot,
    phaseRemainingSeconds,
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
    togglePlayback,
    startRecognition,
    startTraining,
    toggleRecord,
    handlePoseResult,
    handlePoseStats,
    finishSession,
    interruptSession
  }
}
