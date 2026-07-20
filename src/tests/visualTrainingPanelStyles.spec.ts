import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('VisualTrainingPanel mini-program styles', () => {
  it('does not use attribute selectors forbidden in component WXSS', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toMatch(/\.[\w-]+\[disabled\]/)
  })

  it('keeps a single native camera lifecycle instead of replacing a preview camera', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toMatch(/<camera\s+[\s\S]*?v-else/)
  })
})
