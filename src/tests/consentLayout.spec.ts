import { describe, expect, it } from 'vitest'
import { consentFieldStyle } from '../uni-app/platform/consentLayout'

describe('document-relative consent fields', () => {
  const field = { page: 0, x: .24, y: .7, width: .16, height: 12 / 842, font_size: 12 / 595 }
  it('scales both geometry and typography with the displayed page on different screens', () => {
    const small = consentFieldStyle(field, 300, 300 * 842 / 595, '李芳滨')
    const large = consentFieldStyle(field, 450, 450 * 842 / 595, '李芳滨')
    expect(small.left).toBe(large.left)
    expect(small.height).toBe(large.height)
    expect(parseFloat(large.fontSize) / parseFloat(small.fontSize)).toBeCloseTo(1.5)
  })
  it.each([280, 327, 450])('fits full glyphs and enlarges signatures without covering labels or dates at width %s', width => {
    const height = width * 842 / 595
    const layout = { participant: field, researcher: { ...field, x: .62 },
      participant_date: { ...field, x: .18, y: field.y + 20 / 842 },
      researcher_date: { ...field, x: .56, y: field.y + 20 / 842 } }
    const signature = consentFieldStyle(field, width, height, '点击进行电子签名', 'participant', layout)
    const researcher = consentFieldStyle(layout.researcher, width, height, '李芳滨', 'researcher', layout)
    const date = consentFieldStyle(layout.participant_date, width, height, '2026年10月13日', 'participant_date', layout)
    const pixels = (value: string, total: number) => parseFloat(value) / 100 * total
    expect(pixels(signature.width, width)).toBeGreaterThan(field.width * width)
    expect(pixels(signature.height, height)).toBeGreaterThan(field.height * height)
    expect(parseFloat(signature.fontSize) * 8 + 6).toBeLessThanOrEqual(pixels(signature.width, width) + .001)
    expect(parseFloat(signature.fontSize) * 1.4 + 6).toBeLessThanOrEqual(pixels(signature.height, height) + .001)
    expect(parseFloat(researcher.fontSize)).toBeGreaterThan(field.font_size * width)
    expect(parseFloat(researcher.fontSize) * 1.4).toBeLessThanOrEqual(pixels(researcher.height, height))
    expect(pixels(signature.left, width) + pixels(signature.width, width)).toBeLessThan((layout.researcher.x - 6 * field.font_size) * width)
    expect(pixels(signature.top, height) + pixels(signature.height, height)).toBeLessThan(pixels(date.top, height))
  })
  it('does not expand a manual box across the neighbouring label', () => {
    const closeNeighbour = { ...field, x: .43 }
    const style = consentFieldStyle(field, 300, 425, '签名', 'participant', { researcher: closeNeighbour })
    expect(parseFloat(style.width)).toBeCloseTo(field.width * 100)
  })
})
