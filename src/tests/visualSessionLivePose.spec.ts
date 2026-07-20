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
    expect(source).toMatch(/<PoseDetectionView[\s\S]*v-if="recognitionEnabled && poseMountReady"[\s\S]*:initial-fps="recognitionFps"/)
    expect(source).toContain('启动 5fps 识别')
    expect(source).toContain('启动 10fps 识别')
    expect(source).toContain('选择识别帧率后开启摄像头')
    expect(source).not.toMatch(/<camera\s/)
    expect(source).toContain('POSE_MOUNT_DELAY_MS')
    expect(source).toMatch(/v-if="recognitionEnabled"[\s\S]*教学视频已释放/)
    expect(source).toContain('采样识别中')
    expect(source).toContain('FPS 采样识别')
    expect(source).toContain('defineExpose({ startRecord, stopRecord })')
  })
})
