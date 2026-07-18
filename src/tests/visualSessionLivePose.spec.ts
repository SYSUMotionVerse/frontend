import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session live pose wiring', () => {
  it('mounts PoseDetectionView only after the tester starts recognition', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain("import PoseDetectionView from '../../uni-app/components/pose/PoseDetectionView.vue'")
    expect(source).toMatch(/<PoseDetectionView[\s\S]*v-if="recognitionEnabled"[\s\S]*:initial-fps="recognitionFps"/)
    expect(source).toContain('启动 5fps 识别')
    expect(source).toContain('启动 10fps 识别')
    expect(source).toContain('frame-size="small"')
    expect(source).toContain('defineExpose({ startRecord, stopRecord })')
  })
})
