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
  it('keeps long signature instructions inside the original blank instead of clipping or wrapping', () => {
    const style = consentFieldStyle(field, 300, 300 * 842 / 595, '点击进行电子签名')
    expect(parseFloat(style.fontSize) * 8).toBeLessThanOrEqual(field.width * 300 - 4)
  })
})
