import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session dock button styles', () => {
  it('clears the native mini-program button after border on dock actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toMatch(/\.visual-session__secondary::after[\s\S]*border:\s*none;/)
    expect(source).toMatch(/\.visual-session__record::after[\s\S]*border:\s*none;/)
    expect(source).toMatch(/\.visual-session__playback-control::after[\s\S]*border:\s*none;/)
    expect(source).toMatch(/\.visual-session__completion-retry::after[\s\S]*border:\s*none;/)
  })
})
