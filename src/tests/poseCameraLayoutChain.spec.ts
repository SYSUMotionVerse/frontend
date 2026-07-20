import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual training camera layout chain', () => {
  it('gives every custom-component host between the stage and camera an explicit size', () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )
    const detectorSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(panelSource).toMatch(/<PoseDetectionView[\s\S]*class="visual-session__pose-view"/)
    expect(panelSource).toMatch(
      /\.visual-session__pose-view\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/
    )
    expect(detectorSource).toMatch(/<PoseCamera[\s\S]*class="pose-detection-view__camera"/)
    expect(detectorSource).toMatch(
      /\.pose-detection-view__camera\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/
    )
  })
})
