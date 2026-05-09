import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session dock button styles', () => {
  it('clears the native mini-program button after border on dock actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/training/visual-session.vue'),
      'utf8'
    )

    expect(source).toMatch(/\.session-dock__side-action::after\s*\{[\s\S]*border:\s*none;/)
    expect(source).toMatch(/\.session-dock__record-action::after\s*\{[\s\S]*border:\s*none;/)
  })
})
