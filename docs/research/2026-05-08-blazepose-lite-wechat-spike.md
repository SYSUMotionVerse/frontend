# BlazePose-Lite WeChat Miniprogram Spike

**Date:** 2026-05-08
**Objective:** Determine whether BlazePose-Lite can run in a WeChat miniprogram and measure inference latency.

## Verified layers

| Layer | Status | Notes |
|-------|--------|-------|
| TFJS + WebGL init | ✅ | `wx.createOffscreenCanvas({ type: 'webgl' })` + `setupWechatPlatform` |
| Model loading | ✅ | `detectorModelUrl` / `landmarkModelUrl` → HTTP (dev: localhost) |
| Warmup inference | ✅ | `tf.tensor3d` 1×1×3 → `estimatePoses` |
| Synthetic benchmark | ✅ | 224×224×3 and 480×640×3, 50 iterations each |
| Live camera inference | ❌ | Current macOS DevTools environment has no camera device (`start:fail camera is not found`) — live E2E not yet verified |

## Latency (WebGL backend, MacBook Air)

| Metric | Value |
|--------|-------|
| Load (platform + detector) | **77ms** |
| Warmup (WebGL shader JIT) | **539ms** (one-time) |
| Inference 224×224 | p50=37ms, p95=48ms |
| Inference 640×480 | p50=38ms, p95=49ms |

**Steady-state inference: ~40-50ms/frame (p50-p95).**

The 224×224 `max=510ms` outlier skews its avg to 46.5ms; likely first-iteration JIT or GC. The 640×480 numbers are clean (min=31, max=52).

## Dead ends explored

| Approach | Why it failed |
|----------|---------------|
| `wx.getFileSystemManager().readFile` (local static) | Permission denied — code package files are not readable via FileSystemManager |
| `wx.request` with local paths | Invalid URL — wx.request only accepts HTTP/HTTPS |
| TF Hub built-in URLs | 302 redirect to Kaggle → serves HTML, not JSON |
| Embedded base64 JS constants | 11.8MB exceeds WeChat 2MB per-package limit |
| Dynamic `import()` for code-splitting | uni-app mp-weixin compiles `await import()` to string literal |
| `fromPixels({ data: Uint8Array })` | Expects `Uint32Array` or browser-native types absent in WeChat |
| Fake ImageData warmup | `instanceof ImageData` fails — ImageData constructor absent in WeChat runtime |

## Working solution

**Model loading:** HTTP via `wx.request` (dev: `pnpm serve:pose-models`, serving `models/pose`). Prod would need OSS/CDN hosting.

**Frame input:** Convert `Uint8Array` RGBA camera frames to `tf.Tensor3D` and `tf.slice` to RGB:
```typescript
const rgbaTensor = tf.tensor3d(frame.data, [H, W, 4]);
const rgbTensor = tf.slice(rgbaTensor, [0, 0, 0], [H, W, 3]);
rgbaTensor.dispose();
await detector.estimatePoses(rgbTensor);
rgbTensor.dispose();
```

**Warmup:** Real tensor (not fake ImageData):
```typescript
tf.tensor3d(new Float32Array([0, 0, 0]), [1, 1, 3])
```

## Files changed

- `src/uni-app/components/pose/PoseDetectModel.ts` — added `MODEL_BASE` + `detectorModelUrl` / `landmarkModelUrl`
- `src/uni-app/components/pose/PoseDetectionView.vue` — tensor warmup, tensor frame input, synthetic benchmark
- `src/uni-app/components/pose/fetch.ts` — WeChat wx.request polyfill for TFJS
- `src/uni-app/components/pose/wechat_platform.ts` — WebGL platform setup
- `models/pose/**` — local model files served over HTTP for real-device preview

## Next steps

1. **Live camera E2E:** Test on physical device (iPhone/Android) with WeChat DevTools preview, or WeChat's real-device debugging
2. **Production model hosting:** Move model files to OSS/CDN with proper caching headers
3. **Frame rate tuning:** Throttle frames to ~10fps to stay within 40-50ms inference budget
4. **Optimization if 40-50ms is too slow:** Evaluate lighter model, lower input resolution, reduced frame rate, or non-on-device inference (Heavy model would be slower, not faster)
