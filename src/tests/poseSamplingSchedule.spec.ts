import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getNextSamplingDelayMs, getSamplingIntervalMs } from '../uni-app/components/pose/poseSamplingSchedule'

describe('sampled pose inference schedule', () => {
  it('converts the selected 5fps and 10fps modes into their real frame intervals', () => {
    expect(getSamplingIntervalMs(5)).toBe(200)
    expect(getSamplingIntervalMs(10)).toBe(100)
  })

  it('subtracts completed work from the next delay without allowing overlapping work', () => {
    expect(getNextSamplingDelayMs(5, 80)).toBe(120)
    expect(getNextSamplingDelayMs(10, 140)).toBe(0)
  })

  it('uses the selected fps in the production sampled-inference call site', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseDetectionView.vue'),
      'utf8'
    )

    expect(source).toContain('getNextSamplingDelayMs(samplingFps.value, elapsedMs)')
    expect(source).not.toContain('SAMPLING_FALLBACK_INTERVAL_MS = 600')
  })
})
