import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getNextSamplingDelayMs, getSamplingIntervalMs } from '../subpackages/training/components/pose/poseSamplingSchedule'

describe('sampled pose inference schedule', () => {
  it('converts the selected 5fps and 10fps modes into their real frame intervals', () => {
    expect(getSamplingIntervalMs(5)).toBe(200)
    expect(getSamplingIntervalMs(10)).toBe(100)
  })

  it('subtracts completed work from the next delay without allowing overlapping work', () => {
    expect(getNextSamplingDelayMs(5, 80)).toBe(120)
    expect(getNextSamplingDelayMs(10, 140)).toBe(0)
  })

  it('does not use the sampling schedule for automatic production inference', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    // The continuous frame path throttles via PoseCamera's targetFps prop,
    // not via the sampling schedule's getNextSamplingDelayMs timer.
    expect(source).not.toContain('getNextSamplingDelayMs')
    expect(source).toContain(':target-fps="samplingFps"')
  })
})
