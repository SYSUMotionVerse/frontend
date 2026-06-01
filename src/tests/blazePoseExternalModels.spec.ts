import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('BlazePose external model assets', () => {
  it('keeps local model files outside src for HTTP serving during real-device preview', () => {
    const modelRoot = resolve(process.cwd(), 'models/pose')
    const detectorModel = resolve(modelRoot, 'detector/model.json')
    const landmarkModel = resolve(modelRoot, 'landmark_lite/model.json')
    const detectorShard = resolve(modelRoot, 'detector/group1-shard1of2.bin')
    const landmarkShard = resolve(modelRoot, 'landmark_lite/group1-shard1of1.bin')

    expect(existsSync(detectorModel)).toBe(true)
    expect(existsSync(landmarkModel)).toBe(true)
    expect(statSync(detectorShard).size).toBeGreaterThan(1024 * 1024)
    expect(statSync(landmarkShard).size).toBeGreaterThan(1024 * 1024)
  })
})
