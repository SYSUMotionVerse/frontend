import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseDetectionView production mode', () => {
  it('keeps analyze controls debug-only and exposes recording methods', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toMatch(/<view v-if="cameraReady && props\.mode === 'debug'" class="analyze-bar">/)
    expect(source).toMatch(/startRecord:\s*\(\)\s*=>\s*poseCamera\.value\?\.startRecord\?\.\(\)/)
    expect(source).toMatch(/stopRecord:\s*\(\)\s*=>\s*poseCamera\.value\?\.stopRecord\?\.\(\)/)
  })
})
