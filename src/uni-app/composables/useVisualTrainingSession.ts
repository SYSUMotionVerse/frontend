import { computed, onBeforeUnmount, shallowRef, watch, type ShallowRef } from 'vue'
import type { TrainingModality } from '../../domain/student/types'
import type {
  ExerciseArrangementDetail,
  ExerciseArrangementItem,
  ExerciseScoreDetails,
  ExerciseVideoSummary
} from '../api/studentBackendTypes'
import { buildVisualPoseAnalysisPayload, studentBackendSync } from '../api/studentBackend'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import type { DetectResult } from '../../subpackages/training/components/pose/PoseDetectModel'
import type { PoseAngleFrame } from '../components/pose/poseAnalysis'
import { useStudentStore } from './useStudentStore'
import { useVisualTrainingSubmission } from './useVisualTrainingSubmission'
import { invalidateGrowthOverview } from './useGrowthOverview'
import { useTrainingProgress } from './useTrainingProgress'
import { trainingVideoCache } from '../platform/videoCache'
import { actionStandardLoader } from '../platform/actionStandardLoader'
import { aggregateActionScores, scoreAction } from '../../domain/training/actionScoring'
import {
  ACTION_SCORING_VERSION,
  type ActionMotion,
  type ActionStandard,
  type ScoredActionResult
} from '../../domain/training/actionScoringTypes'
import {
  buildVisualWorkoutTimeline,
  initialStartCountdownSeconds,
  initialPreviewDurationSeconds,
  resolveVisualWorkoutState,
  startCueCountdownSeconds,
  type VisualTrainingPlaybackState,
  type VisualWorkoutPhaseKind,
  type VisualWorkoutState
} from '../../features/training/visualWorkoutTimeline'

export interface VisualTrainingCaptureApi {
  startRecord: () => Promise<void>
  stopRecord: () => Promise<string>
}

interface UseVisualTrainingSessionOptions {
  modality: ShallowRef<Exclude<TrainingModality, 'stair'>>
}

const maxPoseAngleFrames = 18_000

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
  const phaseRemainingSeconds = shallowRef(0)
  const trainingStarted = shallowRef(false)
  const startCountdown = shallowRef(0)
  const sessionProgressSeconds = shallowRef(0)
  const videoAutoplay = shallowRef(false)
  const videoLoading = shallowRef(true)
  const videoError = shallowRef('')
  const videoEnded = shallowRef(false)
  const videoProgressSeconds = shallowRef(0)
  const videoDurationSeconds = shallowRef(0)
  const playbackState = shallowRef<VisualTrainingPlaybackState>('idle')
  const recording = shallowRef(false)
  const recordSeconds = shallowRef(0)
  const recordedVideoPath = shallowRef('')
  const recognitionEnabled = shallowRef(false)
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
  let recordTimer: ReturnType<typeof setInterval> | null = null
  let phaseTimer: ReturnType<typeof setInterval> | null = null
  let startCountdownTimer: ReturnType<typeof setInterval> | null = null
  let cacheWarmupTimer: ReturnType<typeof setTimeout> | null = null
  let videoRequestId = 0

  const activeItem = computed(() => arrangement.value?.items?.[activeItemIndex.value] ?? null)
  const primaryVideoId = computed(() => arrangement.value?.items?.[0]?.video_id)
  const exerciseVideo = computed<ExerciseVideoSummary | null>(() => activeItem.value?.video ?? null)
  const sourceVideoUrl = computed(() => exerciseVideo.value?.video_file?.trim() ?? '')
  const videoUrl = computed(() => cachedVideoPaths.value[sourceVideoUrl.value] ?? sourceVideoUrl.value)
  const workoutTimeline = computed(() => buildVisualWorkoutTimeline(arrangement.value?.items ?? []))
  const emptyWorkoutState: VisualWorkoutState = {
    current: {
      id: 'loading',
      kind: 'preview',
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
    if (startCountdown.value > 0) return `${startCountdown.value} 秒后开始准备`
    if (phaseKind.value === 'preview') return `${phaseRemainingSeconds.value} 秒后开始 ${exerciseVideo.value?.title ?? '动作'}`
    if (phaseKind.value === 'rest') return `休息 ${phaseRemainingSeconds.value} 秒，准备下一动作`
    if (phaseKind.value === 'demonstration') return `观看 ${exerciseVideo.value?.title ?? '下一动作'} 示范，暂时不用跟练`
    if (phaseKind.value === 'countdown') return `${phaseRemainingSeconds.value} 秒后开始跟练`
    if (!videoEnded.value) return `动作 ${activeItemIndex.value + 1}/${arrangement.value?.items.length ?? 0}，完整跟随视频训练`
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
    if (phaseTimer) {
      clearInterval(phaseTimer)
      phaseTimer = null
    }
  }

  function clearStartCountdownTimer() {
    if (startCountdownTimer) {
      clearInterval(startCountdownTimer)
      startCountdownTimer = null
    }
  }

  function clearCacheWarmupTimer() {
    if (cacheWarmupTimer) {
      clearTimeout(cacheWarmupTimer)
      cacheWarmupTimer = null
    }
  }

  function syncSessionProgress() {
    const phase = workoutTimeline.value.find(item => (
      item.itemIndex === activeItemIndex.value && item.kind === phaseKind.value
    ))
    if (!phase) return

    const phaseDuration = phase.endSeconds - phase.startSeconds
    const elapsed = Math.max(0, phaseDuration - phaseRemainingSeconds.value)
    sessionProgressSeconds.value = phase.startSeconds + elapsed
  }

  function startPhaseTimer(onComplete: () => void) {
    clearPhaseTimer()
    syncSessionProgress()
    phaseTimer = setInterval(() => {
      phaseRemainingSeconds.value = Math.max(0, phaseRemainingSeconds.value - 1)
      syncSessionProgress()
      if (phaseRemainingSeconds.value === 0) {
        clearPhaseTimer()
        onComplete()
      }
    }, 1000)
  }

  function resumeCurrentPhaseTimer() {
    if (phaseKind.value === 'preview') {
      startPhaseTimer(beginActiveItem)
      return
    }
    if (phaseKind.value === 'rest') {
      startPhaseTimer(beginDemonstration)
      return
    }
    if (phaseKind.value === 'countdown') {
      startPhaseTimer(beginActiveItem)
      return
    }
    if (phaseKind.value === 'demonstration') return
    startPhaseTimer(beginRestOrNextItem)
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

  function beginActiveItem() {
    clearPhaseTimer()
    currentActionFrames.value = []
    phaseKind.value = 'active'
    phaseRemainingSeconds.value = Math.max(1, activeItem.value?.expected_duration ?? 1)
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = exerciseVideo.value?.duration ?? 0
    playbackState.value = 'idle'
    videoAutoplay.value = true
    syncSessionProgress()
    startPhaseTimer(beginRestOrNextItem)
  }

  function beginPreview() {
    clearPhaseTimer()
    clearStartCountdownTimer()
    activeItemIndex.value = 0
    phaseKind.value = 'preview'
    phaseRemainingSeconds.value = initialPreviewDurationSeconds
    playbackState.value = 'idle'
    videoAutoplay.value = true
    syncSessionProgress()
    startPhaseTimer(beginActiveItem)
  }

  function startTraining() {
    if (
      trainingStarted.value
      || startCountdownTimer
      || !arrangement.value
      || !videoUrl.value
      || videoLoading.value
      || videoError.value
    ) return

    trainingStarted.value = true
    startCountdown.value = initialStartCountdownSeconds
    videoAutoplay.value = false
    playbackState.value = 'idle'
    clearStartCountdownTimer()
    startCountdownTimer = setInterval(() => {
      startCountdown.value = Math.max(0, startCountdown.value - 1)
      if (startCountdown.value === 0) beginPreview()
    }, 1000)
  }

  function beginStartCue() {
    clearPhaseTimer()
    phaseKind.value = 'countdown'
    phaseRemainingSeconds.value = startCueCountdownSeconds
    playbackState.value = 'idle'
    videoAutoplay.value = false
    syncSessionProgress()
    startPhaseTimer(beginActiveItem)
  }

  function beginDemonstration() {
    clearPhaseTimer()
    videoError.value = ''
    videoProgressSeconds.value = 0
    videoDurationSeconds.value = exerciseVideo.value?.duration ?? 0
    if (videoDurationSeconds.value <= 0) {
      beginStartCue()
      return
    }
    phaseKind.value = 'demonstration'
    phaseRemainingSeconds.value = videoDurationSeconds.value
    playbackState.value = 'idle'
    videoAutoplay.value = true
    syncSessionProgress()
  }

  function beginRestOrNextItem() {
    finalizeActiveAction()
    const isLastItem = activeItemIndex.value >= (arrangement.value?.items?.length ?? 0) - 1
    if (isLastItem) {
      videoAutoplay.value = false
      videoEnded.value = true
      playbackState.value = 'ended'
      sessionProgressSeconds.value = workoutTimeline.value.at(-1)?.endSeconds ?? 0
      void finishSession()
      return
    }

    activeItemIndex.value += 1
    phaseKind.value = 'rest'
    phaseRemainingSeconds.value = Math.max(0, arrangement.value?.items?.[activeItemIndex.value - 1]?.rest_duration ?? 0)
    playbackState.value = 'idle'
    videoAutoplay.value = false
    void prefetchVideoWindow(activeItemIndex.value)
    syncSessionProgress()
    if (phaseRemainingSeconds.value === 0) {
      beginDemonstration()
      return
    }
    startPhaseTimer(beginDemonstration)
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
        phaseRemainingSeconds.value = initialPreviewDurationSeconds
        syncSessionProgress()
        await restoreCachedVideo(0)
        scheduleVideoPrefetch(0)
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

  function handleVideoTimeUpdate(event: unknown) {
    if (phaseKind.value !== 'active' && phaseKind.value !== 'demonstration') return
    const videoEvent = event as { detail?: { currentTime?: number; duration?: number } }
    const currentTime = videoEvent.detail?.currentTime
    const duration = videoEvent.detail?.duration
    if (typeof currentTime === 'number' && Number.isFinite(currentTime)) {
      videoProgressSeconds.value = currentTime
    }
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      videoDurationSeconds.value = duration
    }
    if (phaseKind.value === 'demonstration' && typeof currentTime === 'number') {
      phaseRemainingSeconds.value = Math.max(0, Math.ceil(videoDurationSeconds.value - currentTime))
      syncSessionProgress()
    }
  }

  function handleVideoPlay() {
    if (!trainingStarted.value || videoEnded.value || !videoAutoplay.value) return
    playbackState.value = 'playing'
    if (!phaseTimer) resumeCurrentPhaseTimer()
  }

  function handleVideoPause() {
    if (videoAutoplay.value || playbackState.value === 'ended') return
    if (phaseKind.value === 'rest' || phaseKind.value === 'countdown') return
    clearPhaseTimer()
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
      clearPhaseTimer()
      playbackState.value = 'paused'
    } else {
      playbackState.value = 'idle'
    }
  }

  function handleVideoEnded(event?: unknown) {
    if (phaseKind.value === 'demonstration') {
      beginStartCue()
      return
    }
    if (phaseKind.value !== 'active') return
    const videoEvent = event as { detail?: { duration?: number; currentTime?: number } } | undefined
    const finalTime = videoEvent?.detail?.currentTime ?? videoEvent?.detail?.duration
    if (typeof finalTime === 'number' && Number.isFinite(finalTime)) {
      videoProgressSeconds.value = finalTime
    }
    playbackState.value = 'paused'
  }

  function handleVideoError() {
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
    poseFallbackSampling.value = stats.status === 'sampling' || stats.status === 'sampling-fallback'
    if (stats.fps > 0) {
      livePoseFps.value = stats.fps
    }
  }

  async function finishSession() {
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

    const durationSeconds = Math.max(
      0,
      Math.round(arrangement.value?.total_duration || videoProgressSeconds.value || 0)
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
    let qualityScore = scoring.score === undefined ? 0 : Math.round(scoring.score)
    let summary = scoring.summary

    try {
      const result = await submission.sync({
        modality: options.modality.value,
        durationSeconds,
        ...(primaryVideoId.value
          ? { videoId: primaryVideoId.value }
          : {}),
        ...(scoring.score !== undefined ? { score: scoring.score } : {}),
        comment: scoring.summary,
        ...(poseAnalysis ? { poseAnalysis } : {})
      })

      if (result.synced && result.record) {
        qualityScore = result.record.score === null || result.record.score === undefined
          ? qualityScore
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

    void uni.redirectTo({
      url: `/pages/training/feedback?sessionId=${encodeURIComponent(submission.sessionId)}`
    })
  }

  async function interruptSession() {
    await stopRecording()
    void uni.redirectTo({ url: '/pages/training/select' })
  }

  watch(options.modality, () => {
    void stopRecording()
    recognitionEnabled.value = false
    poseAngleFrames.value = []
    currentActionFrames.value = []
    actionStandards.value = {}
    actionScores.value = []
    scoringWarnings.value = []
    clearStartCountdownTimer()
    void loadExerciseArrangement()
  }, { immediate: true })

  onBeforeUnmount(() => {
    videoRequestId += 1
    clearRecordTimer()
    clearPhaseTimer()
    clearStartCountdownTimer()
    clearCacheWarmupTimer()
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
    recording,
    recordSeconds,
    recordedVideoPath,
    recognitionEnabled,
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
    phaseRemainingSeconds,
    retryVideo,
    handleVideoTimeUpdate,
    handleVideoPlay,
    handleVideoPause,
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
