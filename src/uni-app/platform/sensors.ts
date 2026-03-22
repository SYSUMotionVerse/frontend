export function createSensorSessionAnalysis(input: {
  durationSeconds: number
  completedIntervals: number
}) {
  const qualityScore = Math.max(60, Math.min(95, 60 + input.completedIntervals * 9 + Math.floor(input.durationSeconds / 10)))

  return {
    qualityScore,
    summary: 'Sensor capture stayed stable — try a slightly higher knee drive next round.',
    capturedBy: 'sensor' as const
  }
}
