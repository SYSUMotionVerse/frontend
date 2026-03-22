import { describe, expect, it } from 'vitest'
import { buildMiniProgramQueryString } from '../uni-app/platform/queryString'

describe('mini-program query string builder', () => {
  it('builds encoded query strings without relying on URLSearchParams', () => {
    const query = buildMiniProgramQueryString({
      checkpoint: 'baseline',
      score: 12,
      percentage: 80,
      submittedAt: '2026-03-19 21:00:00'
    })

    expect(query).toBe(
      'checkpoint=baseline&score=12&percentage=80&submittedAt=2026-03-19%2021%3A00%3A00'
    )
  })

  it('skips undefined values so optional params stay clean', () => {
    const query = buildMiniProgramQueryString({
      checkpoint: 'week4',
      score: undefined,
      submittedAt: ''
    })

    expect(query).toBe('checkpoint=week4&submittedAt=')
  })
})
