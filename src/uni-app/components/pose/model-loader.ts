/**
 * model-loader — BlazePose IOHandler factory.
 *
 * Uses tf.io.fromMemory() to create IOHandlers that bypass the filesystem and
 * network entirely. Model data (JSON topology + base64 weights) is embedded
 * directly in the mini-program bundle.
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
import {
  DETECTOR_MODEL_JSON_CHUNKS,
  DETECTOR_WEIGHT_BASE64_CHUNKS,
  LANDMARK_LITE_MODEL_JSON_CHUNKS,
  LANDMARK_LITE_WEIGHT_BASE64_CHUNKS,
} from './model-data.gen'

// ---------------------------------------------------------------------------
// Types for the embedded model data
// ---------------------------------------------------------------------------
type ModelData = {
  DETECTOR_MODEL_JSON_CHUNKS: string[];
  DETECTOR_WEIGHT_BASE64_CHUNKS: string[];
  LANDMARK_LITE_MODEL_JSON_CHUNKS: string[];
  LANDMARK_LITE_WEIGHT_BASE64_CHUNKS: string[];
}

type ModelKind = 'detector' | 'landmark-lite'

const modelData: ModelData = {
  DETECTOR_MODEL_JSON_CHUNKS,
  DETECTOR_WEIGHT_BASE64_CHUNKS,
  LANDMARK_LITE_MODEL_JSON_CHUNKS,
  LANDMARK_LITE_WEIGHT_BASE64_CHUNKS,
}

const artifactLogState: Record<ModelKind, boolean> = {
  detector: false,
  'landmark-lite': false,
}

/**
 * Create a tf.io.IOHandler for a BlazePose detector model.
 * Returns an IOHandler that serves the model topology and weights from
 * embedded base64 data — no filesystem or network access needed.
 */
export async function createDetectorHandler(): Promise<tf.io.IOHandler> {
  return tf.io.fromMemory(
    toModelArtifacts(
      'detector',
      JSON.parse(modelData.DETECTOR_MODEL_JSON_CHUNKS.join('')),
      modelData.DETECTOR_WEIGHT_BASE64_CHUNKS.join(''),
    ),
  )
}

/**
 * Create a tf.io.IOHandler for a BlazePose landmark-lite model.
 */
export async function createLandmarkLiteHandler(): Promise<tf.io.IOHandler> {
  return tf.io.fromMemory(
    toModelArtifacts(
      'landmark-lite',
      JSON.parse(modelData.LANDMARK_LITE_MODEL_JSON_CHUNKS.join('')),
      modelData.LANDMARK_LITE_WEIGHT_BASE64_CHUNKS.join(''),
    ),
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a base64 string to ArrayBuffer. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof atob !== 'function') {
    return new ArrayBuffer(0)
  }

  // WeChat can truncate extremely large atob() calls, so decode in chunks.
  const chunkChars = 32768
  const bytes = new Uint8Array(Math.floor((base64.length * 3) / 4))
  let byteOffset = 0

  for (let offset = 0; offset < base64.length; offset += chunkChars) {
    const binaryStr = atob(base64.slice(offset, offset + chunkChars))
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[byteOffset++] = binaryStr.charCodeAt(i)
    }
  }

  return bytes.buffer.slice(0, byteOffset)
}

function toModelArtifacts(
  modelKind: ModelKind,
  modelJson: tf.io.ModelJSON,
  weightBase64: string,
): tf.io.ModelArtifacts {
  const weightSpecs = tf.io.getWeightSpecs(modelJson.weightsManifest)
  validateWeightSpecs(modelKind, weightSpecs)

  const artifacts = tf.io.getModelArtifactsForJSONSync(
    modelJson,
    weightSpecs,
    base64ToArrayBuffer(weightBase64),
  )

  logModelArtifactsSummary(modelKind, modelJson, artifacts)

  return artifacts
}

function validateWeightSpecs(
  modelKind: ModelKind,
  weightSpecs: tf.io.WeightsManifestEntry[],
): void {
  if (!weightSpecs.length) {
    throw new Error(`[pose] ${modelKind} model has no weight specs`)
  }

  for (const spec of weightSpecs) {
    if (!spec?.name || !spec?.dtype || !Array.isArray(spec?.shape)) {
      throw new Error(
        `[pose] ${modelKind} weight spec is malformed: ${JSON.stringify({
          name: spec?.name,
          dtype: spec?.dtype,
          shape: spec?.shape,
          quantization: spec?.quantization,
        })}`,
      )
    }
  }
}

function logModelArtifactsSummary(
  modelKind: ModelKind,
  modelJson: tf.io.ModelJSON,
  artifacts: tf.io.ModelArtifacts,
): void {
  if (artifactLogState[modelKind]) {
    return
  }

  artifactLogState[modelKind] = true

  const specs = artifacts.weightSpecs ?? []
  const firstSpec = specs[0]
  const lastSpec = specs[specs.length - 1]

  try {
    console.info('[pose] model artifacts ready', {
      modelKind,
      jsonKeys: Object.keys(modelJson),
      weightSpecCount: specs.length,
      firstWeight: firstSpec
        ? {
            name: firstSpec.name,
            dtype: firstSpec.dtype,
            shape: firstSpec.shape,
            quantization: firstSpec.quantization,
          }
        : null,
      lastWeight: lastSpec
        ? {
            name: lastSpec.name,
            dtype: lastSpec.dtype,
            shape: lastSpec.shape,
            quantization: lastSpec.quantization,
          }
        : null,
      weightDataBytes: getWeightDataBytes(artifacts.weightData),
    })
  } catch {
    // Logging must never block model loading in constrained runtimes.
  }
}

function getWeightDataBytes(weightData: tf.io.WeightData | undefined): number {
  if (!weightData) {
    return 0
  }

  if (Array.isArray(weightData)) {
    return weightData.reduce((total, buffer) => total + buffer.byteLength, 0)
  }

  return weightData.byteLength
}
