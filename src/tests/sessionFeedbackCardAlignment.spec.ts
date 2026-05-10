import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SessionFeedbackCard alignment', () => {
  it('matches the centered questionnaire result layout style for the feedback summary', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/training/SessionFeedbackCard.vue'),
      'utf8'
    )

    expect(source).toContain('text-center')
    expect(source).toContain('align-self: center')
    expect(source).toContain('mx-auto')
    expect(source).toContain('session-feedback-card__summary-grid')
    expect(source).toContain('session-feedback-card__score-tile--soft')
  })
})
