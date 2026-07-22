import * as poseDetection from '@tensorflow-models/pose-detection'
import '@tensorflow/tfjs-backend-cpu'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs-core'
import type { RawPoseSample } from './types'

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
  fps: number
  signal: AbortSignal
  onProgress: (completed: number, total: number, detected: number) => void
}

export async function analyzeVideo(options: AnalyzeVideoOptions): Promise<RawPoseSample[]> {
  const detector = await preparePoseDetector()
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.src = options.objectUrl
  await waitForEvent(video, 'loadedmetadata')

  const maxSide = 640
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法创建视频分析画布')

  const total = Math.max(1, Math.floor((options.end - options.start) * options.fps))
  const samples: RawPoseSample[] = []
  let detected = 0
  for (let index = 0; index < total; index += 1) {
    if (options.signal.aborted) throw new DOMException('分析已取消', 'AbortError')
    const time = Math.min(options.end - 0.001, options.start + index / options.fps)
    await seek(video, time)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const poses = await detector.estimatePoses(canvas, { flipHorizontal: false })
    const pose = poses[0] ?? null
    if (pose) detected += 1
    samples.push({ time, pose })
    options.onProgress(index + 1, total, detected)
  }

  video.removeAttribute('src')
  video.load()
  return samples
}
