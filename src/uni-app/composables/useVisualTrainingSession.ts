import { computed, onBeforeUnmount, shallowRef, watch, type ShallowRef } from 'vue'
import type { TrainingModality } from '../../domain/student/types'
import type { ExerciseVideoSummary } from '../api/studentBackendTypes'
import { buildVisualPoseAnalysisPayload, studentBackendSync } from '../api/studentBackend'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import type { DetectResult } from '../../subpackages/training/components/pose/PoseDetectModel'
import type { PoseAngleFrame } from '../components/pose/poseAnalysis'
import { useStudentStore } from './useStudentStore'
import { useVisualTrainingSubmission } from './useVisualTrainingSubmission'

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

export function useVisualTrainingSession(options: UseVisualTrainingSessionOptions) {
  const store = useStudentStore()
  const submission = useVisualTrainingSubmission()
  const capture = shallowRef<VisualTrainingCaptureApi | null>(null)
  const exerciseVideo = shallowRef<ExerciseVideoSummary | null>(null)
  const videoLoading = shallowRef(true)
  const videoError = shallowRef('')
  const videoEnded = shallowRef(false)
  const videoProgressSeconds = shallowRef(0)
  const recording = shallowRef(false)
  const recordSeconds = shallowRef(0)
  const recordedVideoPath = shallowRef('')
  const recognitionEnabled = shallowRef(false)
  const recognitionFps = shallowRef<5 | 10>(5)
  const livePoseFps = shallowRef(0)
  const poseFallbackSampling = shallowRef(false)
  const completing = shallowRef(false)
  const poseAngleFrames = shallowRef<PoseAngleFrame[]>([])
  const watchedVideoSeconds = new Set<number>()
  let recordTimer: ReturnType<typeof setInterval> | null = null
  let videoRequestId = 0

  const title = computed(() => options.modality.value === 'hiit' ? 'HIIT 引导训练' : '武术引导训练')
  const videoUrl = computed(() => exerciseVideo.value?.video_file?.trim() ?? '')
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
    if (!videoEnded.value) return '完整观看教学视频后可完成训练'
    if (completing.value) return '正在保存训练记录'
    return '教学视频已完成，可以提交训练'
  })

  function clearRecordTimer() {
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
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

  async function loadExerciseVideo() {
    const requestId = ++videoRequestId
    videoLoading.value = true
    videoError.value = ''
    videoEnded.value = false
    videoProgressSeconds.value = 0
    watchedVideoSeconds.clear()
    exerciseVideo.value = null

    try {
      const video = await studentBackendSync.loadVisualExerciseVideo(options.modality.value)
      if (requestId !== videoRequestId) return

      exerciseVideo.value = video
      if (!video?.video_file?.trim()) {
        videoError.value = '当前训练暂未配置可播放的教学视频'
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
    void loadExerciseVideo()
  }

  function handleVideoTimeUpdate(event: unknown) {
    const videoEvent = event as { detail?: { currentTime?: number } }
    const currentTime = videoEvent.detail?.currentTime
    if (typeof currentTime === 'number' && Number.isFinite(currentTime)) {
      videoProgressSeconds.value = currentTime
      watchedVideoSeconds.add(Math.floor(currentTime))
    }
  }

  function handleVideoEnded(event?: unknown) {
    const videoEvent = event as { detail?: { duration?: number; currentTime?: number } } | undefined
    const finalTime = videoEvent?.detail?.currentTime ?? videoEvent?.detail?.duration
    if (typeof finalTime === 'number' && Number.isFinite(finalTime)) {
      videoProgressSeconds.value = finalTime
    }
    const expectedDuration = exerciseVideo.value?.duration ?? finalTime ?? 0
    const requiredWatchedSeconds = Math.max(1, Math.floor(expectedDuration * 0.9))
    videoEnded.value = watchedVideoSeconds.size >= requiredWatchedSeconds
    if (!videoEnded.value) {
      videoError.value = '检测到跳播，请完整观看教学视频后再完成训练'
    } else if (videoError.value.startsWith('检测到跳播')) {
      videoError.value = ''
    }
  }

  function handleVideoError() {
    videoEnded.value = false
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
    if (result.angleFrame && poseAngleFrames.value.length < maxPoseAngleFrames) {
      poseAngleFrames.value.push(result.angleFrame)
    }
  }

  function handlePoseStats(stats: { status: string; fps: number }) {
    poseFallbackSampling.value = stats.status === 'sampling' || stats.status === 'sampling-fallback'
    if (stats.fps > 0) {
      livePoseFps.value = stats.fps
    }
  }

  async function finishSession() {
    if (!canComplete.value) {
      if (typeof uni.showToast === 'function') {
        void uni.showToast({ title: completionHint.value, icon: 'none' })
      }
      return
    }

    completing.value = true
    await stopRecording()

    const durationSeconds = Math.max(
      0,
      Math.round(videoProgressSeconds.value || exerciseVideo.value?.duration || 0)
    )
    const poseAnalysis = buildVisualPoseAnalysisPayload(poseAngleFrames.value)
    let qualityScore = 0
    let summary = poseAnalysis
      ? '教学视频已完成，姿态数据已采集，但暂未获得后端动作评分。'
      : '教学视频已完成，未获得可用姿态识别数据，未生成动作评分。'

    try {
      const result = await submission.sync({
        modality: options.modality.value,
        durationSeconds,
        ...(poseAnalysis ? { poseAnalysis } : {})
      })

      if (result.synced && result.record) {
        qualityScore = toScore(result.record.score)
        summary = result.record.comment?.trim() || (
          qualityScore > 0
            ? `教学视频已完成，动作评分 ${qualityScore} 分。`
            : summary
        )
      }
    } catch (error) {
      reportBackendSyncError('训练记录同步', error)
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

    void uni.redirectTo({ url: '/pages/training/short-questionnaire' })
  }

  async function interruptSession() {
    await stopRecording()
    void uni.redirectTo({ url: '/pages/training/select' })
  }

  watch(options.modality, () => {
    void stopRecording()
    recognitionEnabled.value = false
    poseAngleFrames.value = []
    void loadExerciseVideo()
  }, { immediate: true })

  onBeforeUnmount(() => {
    videoRequestId += 1
    clearRecordTimer()
    if (recording.value) {
      recording.value = false
      void capture.value?.stopRecord().catch(() => {})
    }
  })

  return {
    capture,
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
    title,
    canComplete,
    completionHint,
    retryVideo,
    handleVideoTimeUpdate,
    handleVideoEnded,
    handleVideoError,
    startRecognition,
    toggleRecord,
    handlePoseResult,
    handlePoseStats,
    finishSession,
    interruptSession
  }
}
