import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session dock button styles', () => {
  it('clears the native mini-program button after border on remaining dock actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toMatch(/\.visual-session__secondary::after[\s\S]*border:\s*none;/)
    expect(source).not.toContain('.visual-session__record')
    expect(source).not.toContain('.visual-session__playback-control')
    expect(source).toMatch(/\.visual-session__completion-retry::after[\s\S]*border:\s*none;/)
  })

  it('uses the questionnaire selected-option accent for the portrait exit action', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain('hover-class="visual-session__secondary--pressed"')
    expect(source).toContain('color="#FF8B8B"')
    expect(source).toMatch(
      /\.visual-session__secondary\s*\{[\s\S]*border:\s*2rpx solid #FF8B8B;[\s\S]*background:\s*#FFFCF8;[\s\S]*color:\s*#FF8B8B;/
    )
  })
})
