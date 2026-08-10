import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session live pose wiring', () => {
  it('starts the camera automatically without a manual recording action', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain("import PoseDetectionView from './pose/PoseDetectionView.vue'")
    expect(source).toMatch(/<PoseDetectionView[\s\S]*v-if="recognitionEnabled && poseMountReady"[\s\S]*:initial-fps="recognitionFps"/)
    expect(source).toContain('function requestCameraStart()')
    expect(source).toContain('onMounted(requestCameraStart)')
    expect(source).toContain('正在启动摄像头')
    expect(source).toContain('visual-session__camera-stage')
    expect(source).toContain('visual-session__video')
    expect(source).not.toContain('visual-session__recognition-actions')
    expect(source).toContain("emit('startRecognition', 5)")
    expect(source).not.toContain('@click="handleRecordAction"')
    expect(source).not.toContain("emit('toggleRecord')")
    expect(source).not.toContain('visual-session__record')
    expect(source).not.toContain('录制自己')
    expect(source).not.toContain('开启相机后')
    expect(source).not.toMatch(/<camera\s/)
    expect(source).toContain('POSE_MOUNT_DELAY_MS')
    expect(source).not.toContain('教学视频已释放')
    expect(source).toMatch(/visual-session__video[\s\S]*visual-session__camera-stage[\s\S]*visual-session__lower-grid/)
    expect(source).toContain('采样识别中')
    expect(source).toContain('FPS 采样识别')
    expect(source).toContain('defineExpose({ startRecord, stopRecord })')
  })
})
