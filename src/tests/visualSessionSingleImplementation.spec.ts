import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session route ownership', () => {
  it('keeps the pages.json route as the only business implementation', () => {
    const routedPage = readFileSync(
      resolve(process.cwd(), 'src/pages/training/visual-session.vue'),
      'utf8'
    )
    const legacyPage = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/visual-session.vue'),
      'utf8'
    )

    expect(routedPage).toContain('useVisualTrainingSession')
    expect(routedPage).toContain('<VisualTrainingPanel')
    expect(legacyPage).toContain("import VisualSessionPage from '../../../pages/training/visual-session.vue'")
    expect(legacyPage).not.toContain('finishSession')
    expect(legacyPage).not.toContain('syncVisualSession')
  })
})
