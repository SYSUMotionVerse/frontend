import { zlibSync } from 'fflate'
import type { SignaturePixels } from './signatureOcr'

export type SignatureSegment = readonly [number, number, number, number]
export interface SignatureDraft { width: number, height: number, strokes: readonly (readonly SignatureSegment[])[] }

export const yieldSignatureUi = () => new Promise<void>(resolve => setTimeout(resolve, 0))

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(data.length + 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  for (let index = 0; index < 4; index++) bytes[index + 4] = type.charCodeAt(index)
  bytes.set(data, 8)
  let crc = 0xffffffff
  for (let index = 4; index < bytes.length - 4; index++) crc = crcTable[(crc ^ bytes[index]!) & 255]! ^ (crc >>> 8)
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
  return bytes
}

function base64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const parts: string[] = []
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!, b = bytes[index + 1] ?? 0, c = bytes[index + 2] ?? 0
    parts.push(alphabet[a >>> 2]! + alphabet[((a & 3) << 4) | (b >>> 4)]!
      + (index + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >>> 6)] : '=')
      + (index + 2 < bytes.length ? alphabet[c & 63] : '='))
  }
  return parts.join('')
}

function png(pixels: SignaturePixels) {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, pixels.width)
  view.setUint32(4, pixels.height)
  header[8] = 8
  header[9] = 6 // RGBA, 8 bits per channel.
  const stride = pixels.width * 4
  const rows = new Uint8Array((stride + 1) * pixels.height)
  for (let row = 0; row < pixels.height; row++) rows.set(pixels.data.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlibSync(rows, { level: 1 })), chunk('IEND', new Uint8Array())]
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return base64(result)
}

export function cropSignatureImage(source: SignaturePixels) {
  let left = source.width, top = source.height, right = -1, bottom = -1
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const at = (y * source.width + x) * 4
    const ink = Math.round((255 - source.data[at]!) * .299 + (255 - source.data[at + 1]!) * .587 + (255 - source.data[at + 2]!) * .114)
    if (ink > 60) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  }
  if (right - left + 1 < 20 || bottom - top + 1 < 15) throw new Error('signature_too_small')
  left = Math.max(0, left - 8); top = Math.max(0, top - 8)
  right = Math.min(source.width - 1, right + 8); bottom = Math.min(source.height - 1, bottom + 8)
  const width = right - left + 1, height = bottom - top + 1
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) data.set(source.data.subarray(((top + y) * source.width + left) * 4,
    ((top + y) * source.width + right + 1) * 4), y * width * 4)
  return { imageBase64: png({ width, height, data }), aspect: width / height }
}

// Build both the archived PNG and OCR pixels from the same captured strokes.
// No native canvas readback/export or filesystem bridge runs on completion.
export async function createSignatureImage(segments: readonly SignatureSegment[], width: number, height: number, current = () => true) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 1024 || height > 512 || !segments.length) {
    throw new Error('签名画板尺寸或笔画无效，请重新签名。')
  }
  const scale = 2
  const pixels: SignaturePixels = { width: Math.round(width * scale), height: Math.round(height * scale), data: new Uint8ClampedArray(Math.round(width * scale) * Math.round(height * scale) * 4).fill(255) }
  const radius = 1.5 * scale
  let work = 0
  const check = () => { if (!current()) throw new Error('签名生成已取消。') }
  await yieldSignatureUi()
  check()
  for (const segment of segments) {
    if (!segment.every(Number.isFinite)) throw new Error('签名笔画无效，请重新签名。')
    const [x1, y1, x2, y2] = segment.map(value => value * scale) as [number, number, number, number]
    const dx = x2 - x1, dy = y2 - y1, lengthSquared = dx * dx + dy * dy
    const left = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 1))
    const right = Math.min(pixels.width - 1, Math.ceil(Math.max(x1, x2) + radius + 1))
    const top = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 1))
    const bottom = Math.min(pixels.height - 1, Math.ceil(Math.max(y1, y2) + radius + 1))
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const t = lengthSquared ? Math.max(0, Math.min(1, ((x + .5 - x1) * dx + (y + .5 - y1) * dy) / lengthSquared)) : 0
        const coverage = Math.max(0, Math.min(1, radius + .5 - Math.hypot(x + .5 - x1 - t * dx, y + .5 - y1 - t * dy)))
        const offset = (y * pixels.width + x) * 4
        if (coverage) {
          pixels.data[offset] = Math.min(pixels.data[offset]!, Math.round(255 - 223 * coverage))
          pixels.data[offset + 1] = Math.min(pixels.data[offset + 1]!, Math.round(255 - 204 * coverage))
          pixels.data[offset + 2] = Math.min(pixels.data[offset + 2]!, Math.round(255 - 187 * coverage))
        }
        if (++work >= 4096) { work = 0; await yieldSignatureUi(); check() }
      }
    }
  }
  await yieldSignatureUi()
  check()
  return { imageBase64: png(pixels), pixels }
}
