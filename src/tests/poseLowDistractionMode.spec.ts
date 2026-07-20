import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Pose low-distraction fallback mode', () => {
  it('shows sampled keypoints and a quiet explicit status during fallback', () => {
    const poseViewSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )
    const sessionSource = readFileSync(
      resolve(process.cwd(), 'src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(poseViewSource).toContain('const overlayEnabled = computed(() => showOverlay.value)')
    expect(poseViewSource).toContain(':show-overlay="overlayEnabled"')
    expect(poseViewSource).toContain('if (poses.length > 0 && poses[0].keypoints)')
    expect(sessionSource).toContain('const poseStatusLabel = computed(() =>')
    expect(sessionSource).toContain('采样识别中')
    expect(sessionSource).toContain('FPS 采样识别')
  })
})
