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
})
