import { unzlibSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { createSignatureImage } from '../uni-app/platform/signatureImage'

describe('signature PNG and OCR pixel consistency', () => {
  it('encodes a valid PNG with the same opaque RGBA pixels used for OCR, keeping pen lifts blank', async () => {
    const image = await createSignatureImage([[10, 10, 30, 10], [50, 30, 70, 30]], 80, 40)
    const png = Buffer.from(image.imageBase64, 'base64')
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const chunks: Record<string, Buffer> = {}
    for (let position = 8; position < png.length;) {
      const size = png.readUInt32BE(position)
      const kind = png.toString('ascii', position + 4, position + 8)
      const body = png.subarray(position + 4, position + 8 + size)
      let crc = 0xffffffff
      for (const byte of body) {
        crc ^= byte
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
      }
      expect((crc ^ 0xffffffff) >>> 0).toBe(png.readUInt32BE(position + size + 8))
      chunks[kind] = png.subarray(position + 8, position + 8 + size)
      position += size + 12
    }
    expect(chunks.IHDR!.readUInt32BE(0)).toBe(160)
    expect(chunks.IHDR!.readUInt32BE(4)).toBe(80)
    expect(chunks.IHDR![9]).toBe(6)
    const rows = unzlibSync(chunks.IDAT!)
    for (let row = 0; row < 80; row++) {
      expect(rows[row * 641]).toBe(0)
      expect([...rows.subarray(row * 641 + 1, (row + 1) * 641)]).toEqual([...image.pixels.data.subarray(row * 640, (row + 1) * 640)])
    }
    const pixel = (x: number, y: number) => [...image.pixels.data.subarray((y * 160 + x) * 4, (y * 160 + x) * 4 + 4)]
    expect(pixel(40, 20)).toEqual([32, 51, 68, 255])
    expect(pixel(120, 60)).toEqual([32, 51, 68, 255])
    expect(pixel(80, 40)).toEqual([255, 255, 255, 255])
    expect(pixel(0, 0)).toEqual([255, 255, 255, 255])
  })
  it('yields to UI timers during long strokes and stops promptly when cancelled', async () => {
    let current = true
    let armed = false
    const heartbeat = vi.fn(() => { current = false })
    await expect(createSignatureImage([[0, 0, 319, 190]], 319, 190, () => {
      // Schedule a UI event after rasterization starts, rather than merely
      // exercising the initial yield before any pixels are generated.
      if (!armed) { armed = true; setTimeout(heartbeat, 0) }
      return current
    })).rejects.toThrow('已取消')
    expect(heartbeat).toHaveBeenCalledOnce()
  })
  it('rejects invalid or empty inputs instead of archiving an empty signature', async () => {
    await expect(createSignatureImage([], 319, 190)).rejects.toThrow('无效')
    await expect(createSignatureImage([[0, 0, NaN, 3]], 319, 190)).rejects.toThrow('无效')
  })
})
