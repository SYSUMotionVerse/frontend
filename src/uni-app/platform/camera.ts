import type { TrainingModality } from '../../domain/student/types'

export function createCameraSessionAnalysis(input: {
  modality: Exclude<TrainingModality, 'stair'>
  qualityScore: number
}) {
  return {
    qualityScore: input.qualityScore,
    summary:
      input.modality === 'hiit'
        ? 'Power is there — keep your landing softer.'
        : 'Great control — keep your shoulders relaxed.',
    capturedBy: 'camera' as const
  }
}
