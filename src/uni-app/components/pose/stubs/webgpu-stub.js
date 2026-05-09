// Stub: @tensorflow/tfjs-backend-webgpu is not supported in WeChat miniprogram.
// These named exports exist so pose-detection's static imports can be resolved.
// The actual backend registration and use is handled by PoseDetectionView via
// the wechat-webgl backend, so this stub is never invoked.
export const webgpu_util = {};
export class WebGPUBackend {
  constructor() {
    throw new Error('WebGPUBackend is not supported in WeChat miniprogram');
  }
}
