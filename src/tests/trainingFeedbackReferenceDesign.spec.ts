import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('training feedback reference design', () => {
  it('keeps the result concise, task-oriented, and consistent with the training surfaces', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(pageSource).toContain('feedback-page__eyebrow')
    expect(pageSource).toContain('feedback-page__title')
    expect(pageSource).toContain('feedback-page__score-card')
    expect(pageSource).toContain('feedback-page__score-change')
    expect(pageSource).toContain('质量得分')
    expect(pageSource).toContain('较上次提升')
    expect(pageSource).toContain('首次训练基线')
    expect(pageSource).toContain('feedback-page__badge-card')
    expect(pageSource).toContain('feedback-page__share-action')
    expect(pageSource).toContain('open-type="share"')
    expect(pageSource).toContain('feedback-page__encouragement')
    expect(pageSource).toContain('feedback-page__primary-action')
    expect(pageSource).toContain('feedback-page__secondary-action')
    expect(pageSource).toContain('async function loadSession()')
    expect(pageSource).toContain('feedback-page__retry-action')
    expect(pageSource).toContain('重新加载结果')
    expect(pageSource).not.toContain('feedback-page__halo')
    expect(pageSource).not.toContain('feedback-page__status-pill')
    expect(pageSource).not.toContain('radial-gradient(')
    expect(pageSource).not.toContain('linear-gradient(')
    expect(pageSource).not.toContain('font-size: 96rpx')
    expect(pageSource).toContain('hover-class="feedback-page__primary-action--pressed"')
    expect(pageSource).toContain('hover-class="feedback-page__secondary-action--pressed"')
    expect(pageSource).toContain("numericQualityScore.value >= 85")
  })
})
