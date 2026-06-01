import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('training feedback reference design', () => {
  it('matches the centered celebration + score-card + encouragement-card layout from the provided mock', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(pageSource).toContain('feedback-page__hero-badge')
    expect(pageSource).toContain('feedback-page__sticker')
    expect(pageSource).toContain('feedback-page__score-card')
    expect(pageSource).toContain('feedback-page__badge-card')
    expect(pageSource).toContain('feedback-page__share-action')
    expect(pageSource).toContain('open-type="share"')
    expect(pageSource).toContain('feedback-page__encouragement-card')
    expect(pageSource).toContain('feedback-page__status-pill')
    expect(pageSource).toContain('feedback-page__primary-action')
    expect(pageSource).toContain('feedback-page__secondary-action')
    expect(pageSource).toContain("qualityScore >= 85 ? '太棒了！'")
  })
})
