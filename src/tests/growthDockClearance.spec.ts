import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('growth dock clearance', () => {
  it('reserves scrollable space below the final growth record', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/growth/index.vue'),
      'utf8'
    )

    expect(source).toMatch(/\.growth-page\s*\{[\s\S]*padding-bottom:\s*12rpx;/)
  })
})
