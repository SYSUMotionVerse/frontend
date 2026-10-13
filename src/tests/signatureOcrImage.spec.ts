import { describe, expect, it } from 'vitest'
import { prepareSignatureOcrPixels } from '../uni-app/platform/signatureOcrImage'

describe('signature recognition input', () => {
  it('removes blank margins while preserving all ink and leaving the archived source unchanged', () => {
    const data = new Uint8ClampedArray(638 * 380 * 4).fill(255)
    for (const [x, y] of [[150, 100], [280, 200]]) data.set([32, 51, 68, 255], (y! * 638 + x!) * 4)
    const original = data.slice()
    const result = prepareSignatureOcrPixels({ data, width: 638, height: 380 })
    expect(result.width).toBe(163)
    expect(result.height).toBe(133)
    expect(result.data.filter(value => value === 32)).toHaveLength(2)
    expect(data).toEqual(original)
    expect(result.data.length).toBeLessThan(data.length / 10)
  })
  it('reduces a large crop with its aspect ratio intact and rejects blank or corrupt buffers', () => {
    const data = new Uint8ClampedArray(1440 * 380 * 4).fill(255)
    for (let y = 30; y < 330; y++) for (let x = 30; x < 1400; x++) data.set([32, 51, 68, 255], (y * 1440 + x) * 4)
    const result = prepareSignatureOcrPixels({ data, width: 1440, height: 380 })
    expect(result.width).toBe(640)
    expect(result.height / result.width).toBeCloseTo(332 / 1402, 2)
    expect(() => prepareSignatureOcrPixels({ data: new Uint8ClampedArray(16).fill(255), width: 2, height: 2 })).toThrow('blank')
    expect(() => prepareSignatureOcrPixels({ data: new Uint8ClampedArray(3), width: 2, height: 2 })).toThrow('invalid')
  })
})
