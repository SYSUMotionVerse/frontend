import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('training feedback reference design', () => {
  it('keeps the result concise, task-oriented, and consistent with the training surfaces', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(pageSource).toContain('UniTrainingPageShell')
    expect(pageSource).toContain('show-decorations')
    expect(pageSource).toContain('feedback-page__overview-card')
    expect(pageSource).toContain('feedback-page__change')
    expect(pageSource).toContain('质量得分')
    expect(pageSource).toContain('较上次提升')
    expect(pageSource).toContain('首次训练基线')
    expect(pageSource).toContain('feedback-page__badge-card')
    expect(pageSource).toContain('feedback-page__share-action')
    expect(pageSource).toContain('open-type="share"')
    expect(pageSource).toContain('feedback-page__summary-card')
    expect(pageSource).toContain('TrainingFeedbackBodyMap')
    expect(pageSource).toContain('TrainingFeedbackTrendChart')
    expect(pageSource).toContain('TrainingFeedbackActionCard')
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
