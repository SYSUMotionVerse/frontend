import * as poseDetection from '@tensorflow-models/pose-detection'
import '@tensorflow/tfjs-backend-cpu'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs-core'
import type { RawPoseSample } from './types'

const FALLBACK_SOURCE_FPS = 30
let detectorPromise: Promise<poseDetection.PoseDetector> | null = null

async function createDetector() {
  try {
    await tf.setBackend('webgl')
  } catch {
    await tf.setBackend('cpu')
  }
  await tf.ready()
  return poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
    runtime: 'tfjs',
    modelType: 'lite',
    enableSmoothing: false,
    detectorModelUrl: '/detector/model.json',
    landmarkModelUrl: '/landmark_lite/model.json'
  })
}

export function preparePoseDetector() {
  detectorPromise ??= createDetector()
  return detectorPromise
}

function waitForEvent(target: EventTarget, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('视频解码失败，请检查文件格式'))
    }
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent)
      target.removeEventListener('error', onError)
    }
    target.addEventListener(eventName, onEvent, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

async function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.001) return
  const ready = waitForEvent(video, 'seeked')
  video.currentTime = time
  await ready
}

export interface AnalyzeVideoOptions {
  objectUrl: string
  start: number
  end: number
  signal: AbortSignal
  onProgress: (completed: number, total: number, detected: number) => void
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

async function resolveSourceFps(video: HTMLVideoElement) {
  if (typeof video.requestVideoFrameCallback !== 'function') return FALLBACK_SOURCE_FPS

  const frameTimes: number[] = []
  try {
    await seek(video, 0)
    await video.play()
    const fps = await new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('无法读取视频帧率')), 2_000)
      const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
        frameTimes.push(metadata.mediaTime)
        if (frameTimes.length >= 5) {
          window.clearTimeout(timeout)
          const intervals = frameTimes.slice(1).map((time, index) => time - frameTimes[index])
          resolve(Math.round(1 / median(intervals)))
          return
        }
        video.requestVideoFrameCallback(onFrame)
      }
      video.requestVideoFrameCallback(onFrame)
    })
    return Number.isFinite(fps) && fps > 0 ? fps : FALLBACK_SOURCE_FPS
  } catch {
    return FALLBACK_SOURCE_FPS
  } finally {
    video.pause()
    await seek(video, 0)
  }
}

export interface AnalyzeVideoResult {
  samples: RawPoseSample[]
  sourceFps: number
}

export async function analyzeVideo(options: AnalyzeVideoOptions): Promise<AnalyzeVideoResult> {
  const detector = await preparePoseDetector()
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.src = options.objectUrl
  await waitForEvent(video, 'loadedmetadata')
  const sourceFps = await resolveSourceFps(video)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, video.videoWidth)
  canvas.height = Math.max(1, video.videoHeight)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法创建视频分析画布')

  const total = Math.max(1, Math.ceil((options.end - options.start) * sourceFps))
  const samples: RawPoseSample[] = []
  let detected = 0
  for (let index = 0; index < total; index += 1) {
    if (options.signal.aborted) throw new DOMException('分析已取消', 'AbortError')
    const time = Math.min(options.end - 0.001, options.start + index / sourceFps)
    await seek(video, time)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const poses = await detector.estimatePoses(canvas, { flipHorizontal: false })
    const pose = poses[0] ?? null
    if (pose) detected += 1
    samples.push({ time: video.currentTime, pose })
    options.onProgress(index + 1, total, detected)
  }

  video.removeAttribute('src')
  video.load()
  return { samples, sourceFps }
}
