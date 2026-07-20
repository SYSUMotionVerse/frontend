/**
 * PoseDetectModel — BlazePose-Lite detector configuration for WeChat Miniprogram.
 *
 * Key design decisions:
 * - Runtime: 'tfjs' (not 'mediapipe') — compatible with WeChat's WebGL via tfjs-wechat adapter
 * - Model type: 'lite' (10.4 MB) — smallest BlazePose, fastest load
 * - Backend: 'wechat-webgl' — registered by setupWechatPlatform()
 *
 * Model weights are loaded over HTTP so the WeChat preview source package
 * stays under the 4 MB upload limit.
 */
import type { PoseAngleFrame } from '../../../../uni-app/components/pose/poseAnalysis'

export const BLAZEPOSE_MODEL_NAME = 'BlazePose' as const
export const DEFAULT_POSE_MODEL_BASE_URL = 'http://127.0.0.1:8765'

export interface BlazePoseModelConfigOptions {
  modelBaseUrl?: string
}

export function createBlazePoseModelConfig(options: BlazePoseModelConfigOptions = {}) {
  const configuredBaseUrl = import.meta.env.VITE_POSE_MODEL_BASE_URL?.trim() || undefined
  const modelBaseUrl = (options.modelBaseUrl ?? configuredBaseUrl ?? DEFAULT_POSE_MODEL_BASE_URL).replace(/\/$/, '')

  return {
    runtime: 'tfjs' as const,
    modelType: 'lite' as const,
    enableSmoothing: true,
    detectorModelUrl: `${modelBaseUrl}/detector/model.json`,
    landmarkModelUrl: `${modelBaseUrl}/landmark_lite/model.json`
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
  keypoints3D?: Array<{ x: number; y: number; z?: number; score?: number; name?: string }>;
  box?: { xMin: number; yMin: number; width: number; height: number };
  score?: number;
}

export interface DetectResult {
  pose: Pose;
  /** Time spent in estimatePoses() for this frame (ms) */
  inferMs: number;
  /** Epoch milliseconds for compact serialization. */
  tsMs: number;
  /** Original processed frame number when available. */
  frameIndex?: number;
  /** Confidence-filtered compact angle payload. */
  angleFrame: PoseAngleFrame | null;
}

export type DetectPoseCallback = (result: DetectResult) => void;
