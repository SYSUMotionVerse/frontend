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

  it('does not encourage interruption with a portrait exit action', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toContain('hover-class="visual-session__secondary--pressed"')
    expect(source).not.toContain('color="#FF8B8B"')
    expect(source).not.toContain('v-if="!comparisonMode && !tutorialMode" class="visual-session__actions"')
    expect(source).toContain('class="visual-session__comparison-exit"')
  })
})
