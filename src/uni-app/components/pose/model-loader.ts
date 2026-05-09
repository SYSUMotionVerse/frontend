/**
 * model-loader — BlazePose IOHandler factory.
 *
 * Uses tf.io.fromMemory() to create IOHandlers that bypass the filesystem and
 * network entirely.  Model data (JSON topology + base64 weights) is embedded
 * in a dynamically-imported chunk (code-split away from the main bundle).
 *
 * Pattern:
 *   const handler = await createModelHandler('detector');
 *   const detector = await createDetector('BlazePose', {
 *     runtime: 'tfjs',
 *     modelType: 'lite',
 *     detectorModelUrl: handler.detector,
 *     landmarkModelUrl: handler.landmark,
 *   } as any);
 */
import * as tf from '@tensorflow/tfjs-core';

// ---------------------------------------------------------------------------
// Types for the dynamically-imported model data
// ---------------------------------------------------------------------------
interface ModelData {
  DETECTOR_MODEL_TOPOLOGY: tf.io.ModelArtifacts['modelTopology'];
  DETECTOR_WEIGHT_BASE64: string;
  LANDMARK_LITE_MODEL_TOPOLOGY: tf.io.ModelArtifacts['modelTopology'];
  LANDMARK_LITE_WEIGHT_BASE64: string;
}

// ---------------------------------------------------------------------------
// Cached model data (loaded once via dynamic import)
// ---------------------------------------------------------------------------
let modelData: ModelData | null = null;

/**
 * Lazily load the embedded model data chunk.
 * The large base64 strings are code-split into a separate JS file that is
 * only loaded when the pose-spike page is accessed.
 */
async function loadModelData(): Promise<ModelData> {
  if (modelData) return modelData;

  // Dynamic import — code-split point.  The 11.8 MB model-data.gen.ts becomes
  // a separate JS chunk that vite/uni-app emits alongside the main bundle.
  modelData = (await import('./model-data.gen')) as ModelData;
  return modelData;
}

/**
 * Create a tf.io.IOHandler for a BlazePose detector model.
 * Returns an IOHandler that serves the model topology and weights from
 * embedded base64 data — no filesystem or network access needed.
 */
export async function createDetectorHandler(): Promise<tf.io.IOHandler> {
  const data = await loadModelData();
  const weightData = base64ToArrayBuffer(data.DETECTOR_WEIGHT_BASE64);

  return tf.io.fromMemory({
    modelTopology: data.DETECTOR_MODEL_TOPOLOGY,
    weightSpecs: extractWeightSpecs(
      data.DETECTOR_MODEL_TOPOLOGY as any,
    ),
    weightData,
  });
}

/**
 * Create a tf.io.IOHandler for a BlazePose landmark-lite model.
 */
export async function createLandmarkLiteHandler(): Promise<tf.io.IOHandler> {
  const data = await loadModelData();
  const weightData = base64ToArrayBuffer(data.LANDMARK_LITE_WEIGHT_BASE64);

  return tf.io.fromMemory({
    modelTopology: data.LANDMARK_LITE_MODEL_TOPOLOGY,
    weightSpecs: extractWeightSpecs(
      data.LANDMARK_LITE_MODEL_TOPOLOGY as any,
    ),
    weightData,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a base64 string to ArrayBuffer. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryStr = typeof atob === 'function' ? atob(base64) : '';
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Extract weight specs from model topology's weightsManifest.
 *
 * The weightsManifest is an array of groups.  Each group has:
 *   - paths: string[] — shard file names (not used for fromMemory)
 *   - weights: Array<{ name: string; shape: number[]; dtype: string }>
 *
 * fromMemory expects a flat list of { name, shape, dtype } entries in the
 * same order as the concatenated weight data.
 */
function extractWeightSpecs(topology: any): tf.io.WeightsManifestEntry[] {
  const manifest = topology?.weightsManifest;
  if (!manifest || !Array.isArray(manifest)) return [];

  const specs: tf.io.WeightsManifestEntry[] = [];
  for (const group of manifest) {
    for (const w of group.weights ?? []) {
      specs.push({
        name: w.name as string,
        shape: w.shape as number[],
        dtype: w.dtype as any,
      });
    }
  }
  return specs;
}
