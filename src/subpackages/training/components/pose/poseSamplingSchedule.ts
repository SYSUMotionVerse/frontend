export function getSamplingIntervalMs(targetFps: number) {
  const normalizedFps = Math.max(1, Math.round(targetFps))
  return Math.round(1000 / normalizedFps)
}

export function getNextSamplingDelayMs(targetFps: number, elapsedMs: number) {
  return Math.max(0, getSamplingIntervalMs(targetFps) - Math.max(0, elapsedMs))
}
