import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getRatingOptionClasses } from '../features/questionnaire/ratingOptionStyles'

describe('questionnaire rating option styles', () => {
  it('adds a strong persistent highlight to selected gold options', () => {
    const classes = getRatingOptionClasses(true, 'gold')

    expect(classes).toContain('rating-option')
    expect(classes).toContain('rating-option--selected')
    expect(classes).toContain('rating-option--gold')
  })

  it('keeps unselected options visibly neutral', () => {
    const classes = getRatingOptionClasses(false, 'blue')

    expect(classes).toContain('rating-option')
    expect(classes).toContain('rating-option--blue')
    expect(classes).not.toContain('rating-option--selected')
  })

  it('supports each palette with its own stronger selected accent', () => {
    expect(getRatingOptionClasses(true, 'blue')).toContain('rating-option--blue')
    expect(getRatingOptionClasses(true, 'coral')).toContain('rating-option--coral')
  })

  it('keeps long-questionnaire circle options compact enough for miniapp layouts', () => {
    const css = readFileSync(
      resolve('src/features/questionnaire/ratingOptionStyles.css'),
      'utf8'
    )

    expect(css).toMatch(/\.rating-option--circle\s*\{[\s\S]*width:\s*96rpx;[\s\S]*max-width:\s*96rpx;[\s\S]*height:\s*96rpx;[\s\S]*font-size:\s*40rpx;[\s\S]*border-radius:\s*9999px;[\s\S]*\}/)
  })

  it('keeps short-questionnaire rounded options uniformly compact across every rounded prompt', () => {
    const css = readFileSync(
      resolve('src/features/questionnaire/ratingOptionStyles.css'),
      'utf8'
    )

    expect(css).toMatch(/\.rating-option--rounded\s*\{[\s\S]*width:\s*92rpx;[\s\S]*max-width:\s*92rpx;[\s\S]*height:\s*92rpx;[\s\S]*font-size:\s*38rpx;[\s\S]*border-radius:\s*28rpx;[\s\S]*\}/)
  })
})
