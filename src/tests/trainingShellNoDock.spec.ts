import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('UniTrainingPageShell no-dock layout', () => {
  it('adds a dedicated no-dock class so full-screen pages do not inherit dock padding', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )

    expect(source).toContain("'training-shell--no-dock': !props.showDock")
    expect(source).toMatch(/\.training-shell--no-dock\s*\{[\s\S]*padding:\s*24rpx 0 0;/)
    expect(source).toMatch(/\.training-shell__inner--no-dock\s*\{[\s\S]*height:\s*calc\(100vh - 24rpx\);/)
  })
})
