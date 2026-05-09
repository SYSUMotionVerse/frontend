/**
 * Minimal TensorFlow.js + WebGL setup for WeChat Miniprogram.
 *
 * Adapted from the reference implementation:
 *   /tmp/MultiPose-MiniProgram/src/tfjs-plugin/wechat_platform.ts
 *
 * Key design:
 *  - initWebGL is SEPARATE from setupWechatPlatform — the caller must
 *    create the offscreen canvas and inject webgl backend before calling init.
 *  - canvas is passed FROM OUTSIDE (not created inside this module) so the
 *    WebGL context is obtained in the correct mini-program rendering context.
 *  - failIfMajorPerformanceCaveat is kept (matching the reference) because
 *    the reference works on WeChat with it set to true.
 */
import * as tf from '@tensorflow/tfjs-core';
import * as webgl from '@tensorflow/tfjs-backend-webgl';
import {atob, btoa} from 'abab';
import type { SystemConfig } from './PoseDetectModel';

export const WECHAT_WEBGL_BACKEND_NAME = 'wechat-webgl';

/** Set up the TFJS platform for WeChat (fetch + encode/decode). */
export function setupWechatPlatform(config: SystemConfig): void {
  const backendName = config.backendName ?? WECHAT_WEBGL_BACKEND_NAME;
  if (tf.getBackend() === backendName) return;

  tf.ENV.setPlatform('wechat', {
    fetch(path: string, init?: RequestInit) {
      return config.fetchFunc(path, init);
    },
    now() {
      return Date.now();
    },
  } as any);

  // btoa/atob polyfills — needed by TFJS model JSON parser
  tf.ENV.global.btoa = btoa;
  tf.ENV.global.atob = atob;

  if (config.webgl && config.canvas) {
    initWebGL(config.webgl as typeof webgl, config.canvas, backendName);
  } else {
    console.warn(
      '[BlazePose] webgl backend not initialised — ' +
      'please inject webgl and offscreen canvas.',
    );
  }
}

/**
 * Initialise WebGL backend using a WebGLRenderingContext from the given
 * offscreen canvas.  The canvas MUST be created by the caller (e.g. via
 * `wx.createOffscreenCanvas()`) in the correct mini-program page context.
 */
function initWebGL(
  wgl: typeof webgl,
  canvas: any,
  backendName: string,
): void {
  if (tf.findBackend(backendName) != null) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    depth: false,
    stencil: false,
    failIfMajorPerformanceCaveat: true,
  });

  try {
    tf.registerBackend(backendName, () => {
      wgl.setWebGLContext(1, gl);
      tf.ENV.set('WEBGL_VERSION', 1);
      const ctx = new wgl.GPGPUContext(gl);
      return new wgl.MathBackendWebGL(ctx);
    }, 2);

    // Register all 'webgl' kernels under the new backend name
    const kernels = tf.getKernelsForBackend('webgl');
    for (const k of kernels) {
      tf.registerKernel({...k, backendName});
    }
  } catch (e: any) {
    throw new Error(`Failed to register WebGL backend: ${e.message}`);
  }

  tf.setBackend(backendName);
  tf.enableProdMode();
}
