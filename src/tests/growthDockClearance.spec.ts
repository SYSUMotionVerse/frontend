import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('growth dock clearance', () => {
  it('uses the runtime dock clearance below the final growth record', () => {
    const shell = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/growth/UniGrowthPageShell.vue'),
      'utf8'
    )
    const page = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/growth/index.vue'),
      'utf8'
    )

    expect(shell).toContain('--floating-dock-content-clearance')
    expect(shell).toContain('var(--floating-dock-content-clearance, 100px)')
    expect(shell).toContain('class="growth-shell__dock-clearance"')
    expect(shell).toMatch(/\.growth-shell__content\s*\{[\s\S]*padding:\s*16rpx 32rpx 0;/)
    expect(shell).not.toMatch(/\.growth-shell\s*\{[^}]*padding:[^;]*var\(--floating-dock-content-clearance/)
    expect(shell).toMatch(/\.growth-shell__dock-clearance\s*\{[\s\S]*flex:\s*0 0 var\(--floating-dock-content-clearance, 100px\);/)
    expect(shell).toContain("'growth-shell--no-dock': !props.showDock")
    expect(shell).toMatch(/\.growth-shell--no-dock\s*\{[\s\S]*padding-bottom:\s*0;/)
    expect(page).toMatch(/\.growth-page__section-shell--explore \.growth-page__section-head\s*\{[\s\S]*margin-bottom:\s*12rpx;/)
    expect(page).toMatch(/\.growth-page__section-title\s*\{[\s\S]*font-size:\s*30rpx;/)
    expect(page).toMatch(/\.growth-page__exploration-title\s*\{[\s\S]*font-size:\s*28rpx;/)
    expect(page).toMatch(/\.growth-page__exploration-meta\s*\{[\s\S]*font-size:\s*22rpx;/)
  })
})
