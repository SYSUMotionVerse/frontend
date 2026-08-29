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
    expect(source).toMatch(/\.training-shell--no-dock\s*\{[\s\S]*padding:\s*0;/)
    expect(source).toMatch(/\.training-shell__inner--no-dock\s*\{[\s\S]*min-height:\s*0;/)
  })

  it('removes the remaining top inset when a no-dock page explicitly fills the viewport', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )

    expect(source).toMatch(
      /\.training-shell--no-dock\.training-shell--fit-viewport\s*\{[\s\S]*padding:\s*0;/
    )
    expect(source).toMatch(
      /\.training-shell__inner--no-dock\.training-shell__inner--fit-viewport\s*\{[\s\S]*height:\s*100%;/
    )
  })

  it('uses the same ambient treatment as growth only on ordinary docked pages', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )

    expect(source).toContain('background: #FCF7F0;')
    expect(source).toContain('v-if="props.showDock || props.showDecorations"')
    expect(source).toContain('showDecorations?: boolean')
    expect(source).toContain('training-shell__halo--coral')
    expect(source).toContain('training-shell__halo--gold')
    expect(source).toContain('padding: 0 32rpx calc(132rpx + env(safe-area-inset-bottom));')
    expect(source).toContain('ImmersiveNavigationBar')
    expect(source).toContain('training-shell__halo--teal')
  })
})
