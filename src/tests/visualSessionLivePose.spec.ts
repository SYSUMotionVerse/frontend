import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session live pose wiring', () => {
  it('mounts PoseDetectionView only after the tester starts recognition', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain("import PoseDetectionView from './pose/PoseDetectionView.vue'")
    expect(source).toMatch(/<PoseDetectionView[\s\S]*v-if="recognitionEnabled && poseMountReady"[\s\S]*:initial-fps="recognitionFps"/)
    expect(source).toContain('开启相机')
    expect(source).toContain('开启相机后可识别动作和录制自己')
    expect(source).toContain('visual-session__camera-panel')
    expect(source).toContain('visual-session__video')
    expect(source).not.toContain('visual-session__recognition-actions')
    expect(source).toContain("emit('startRecognition', 5)")
    expect(source).toContain('@click="handleRecordAction"')
    expect(source).toContain("emit('toggleRecord')")
    expect(source).not.toMatch(/<camera\s/)
    expect(source).toContain('POSE_MOUNT_DELAY_MS')
    expect(source).not.toContain('教学视频已释放')
    expect(source).toMatch(/visual-session__video[\s\S]*visual-session__lower-grid[\s\S]*visual-session__camera-panel/)
    expect(source).toContain('采样识别中')
    expect(source).toContain('FPS 采样识别')
    expect(source).toContain('defineExpose({ startRecord, stopRecord })')
  })
})
