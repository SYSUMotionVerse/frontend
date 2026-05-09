/**
 * PoseDetectModel — BlazePose-Lite detector configuration for WeChat Miniprogram.
 *
 * Key design decisions:
 * - Runtime: 'tfjs' (not 'mediapipe') — compatible with WeChat's WebGL via tfjs-wechat adapter
 * - Model type: 'lite' (10.4 MB) — smallest BlazePose, fastest load
 * - Backend: 'wechat-webgl' — registered by setupWechatPlatform()
 *
 * Model weights are embedded and served through tf.io IOHandlers so the
 * mini-program does not depend on a localhost dev server or external CDN.
 */
import * as tf from '@tensorflow/tfjs-core'
import { createDetectorHandler, createLandmarkLiteHandler } from './model-loader'

export const BLAZEPOSE_MODEL_NAME = 'BlazePose' as const

export interface BlazePoseModelLoaders {
  createDetectorHandler: () => Promise<tf.io.IOHandler>
  createLandmarkLiteHandler: () => Promise<tf.io.IOHandler>
}

const defaultLoaders: BlazePoseModelLoaders = {
  createDetectorHandler,
  createLandmarkLiteHandler
}

export async function createBlazePoseModelConfig(
  loaders: BlazePoseModelLoaders = defaultLoaders
) {
  const [detectorModelUrl, landmarkModelUrl] = await Promise.all([
    loaders.createDetectorHandler(),
    loaders.createLandmarkLiteHandler()
  ])

  return {
    runtime: 'tfjs' as const,
    modelType: 'lite' as const,
    enableSmoothing: true,
    detectorModelUrl,
    landmarkModelUrl
  }
}

// ---------------------------------------------------------------------------
// Types (mirrored from reference for self-documentation)
// ---------------------------------------------------------------------------

export interface Frame {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface SystemConfig {
  fetchFunc: (path: string, init?: RequestInit) => Promise<Response>;
  tf: any;
  webgl: any;
  canvas: any;
  backendName?: string;
}

export interface Pose {
  keypoints: Array<{ x: number; y: number; score?: number; name?: string }>;
  box?: { xMin: number; yMin: number; width: number; height: number };
  score?: number;
}

export interface DetectResult {
  pose: Pose;
  /** Time spent in estimatePoses() for this frame (ms) */
  inferMs: number;
  /** Wall-clock timestamp */
  ts: Date;
}

export type DetectPoseCallback = (result: DetectResult) => void;
