import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('training feedback reference design', () => {
  it('keeps a single feedback heading with score, encouragement, and clear actions', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(pageSource).toContain('feedback-page__eyebrow')
    expect(pageSource).toContain('feedback-page__title')
    expect(pageSource).toContain('feedback-page__score-card')
    expect(pageSource).toContain('feedback-page__score-change')
    expect(pageSource).toContain('较上次提升')
    expect(pageSource).toContain('首次训练基线')
    expect(pageSource).toContain('feedback-page__badge-card')
    expect(pageSource).toContain('feedback-page__share-action')
    expect(pageSource).toContain('open-type="share"')
    expect(pageSource).toContain('feedback-page__encouragement-card')
    expect(pageSource).toContain('feedback-page__status-pill')
    expect(pageSource).toContain('feedback-page__primary-action')
    expect(pageSource).toContain('feedback-page__secondary-action')
    expect(pageSource).toContain("qualityScore.value >= 85")
  })
})
