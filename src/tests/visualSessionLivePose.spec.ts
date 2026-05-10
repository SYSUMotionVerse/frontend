import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session live pose wiring', () => {
  it('uses PoseDetectionView in production mode instead of a raw PoseCamera', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/visual-session.vue'),
      'utf8'
    )

    expect(source).toContain("import PoseDetectionView from '../../components/pose/PoseDetectionView.vue'")
    expect(source).toMatch(/<PoseDetectionView[\s\S]*:mode="'production'"/)
    expect(source).not.toContain('<PoseCamera')
  })
})
