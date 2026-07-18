import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Pose low-distraction fallback mode', () => {
  it('suppresses overlay drawing and noisy realtime badges during sampled fallback', () => {
    const poseViewSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const sessionSource = readFileSync(
      resolve(process.cwd(), 'src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(poseViewSource).toContain('const overlayEnabled = computed(() =>')
    expect(poseViewSource).toContain('!usingSamplingFallback')
    expect(poseViewSource).toContain(':show-overlay="overlayEnabled"')
    expect(poseViewSource).toContain('if (!usingSamplingFallback && poses.length > 0 && poses[0].keypoints)')
    expect(sessionSource).toContain("v-if=\"livePoseFps > 0 && !poseFallbackSampling\"")
    expect(sessionSource).toContain('poseFallbackSampling')
  })
})
