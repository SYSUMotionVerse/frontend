import type { SignaturePixels } from './signatureOcr'

// Only remove blank margins and reduce oversized input. The uploaded PNG stays
// unchanged, and the recognition input still contains every written stroke.
export function prepareSignatureOcrPixels(source: SignaturePixels): SignaturePixels {
  const { width, height, data } = source
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 1024 || data.length !== width * height * 4) {
    throw new Error('signature_input_invalid')
  }
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    if (data[offset + 3]! > 0 && Math.min(data[offset]!, data[offset + 1]!, data[offset + 2]!) < 245) {
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) throw new Error('signature_input_blank')
  const margin = 16
  left = Math.max(0, left - margin); top = Math.max(0, top - margin)
  right = Math.min(width - 1, right + margin); bottom = Math.min(height - 1, bottom + margin)
  const cropWidth = right - left + 1, cropHeight = bottom - top + 1
  const scale = Math.min(1, 640 / Math.max(cropWidth, cropHeight))
  const targetWidth = Math.max(1, Math.round(cropWidth * scale)), targetHeight = Math.max(1, Math.round(cropHeight * scale))
  const target = new Uint8ClampedArray(targetWidth * targetHeight * 4).fill(255)
  for (let y = 0; y < targetHeight; y++) for (let x = 0; x < targetWidth; x++) {
    const from = ((top + Math.min(cropHeight - 1, Math.floor((y + .5) * cropHeight / targetHeight))) * width
      + left + Math.min(cropWidth - 1, Math.floor((x + .5) * cropWidth / targetWidth))) * 4
    const to = (y * targetWidth + x) * 4
    for (let channel = 0; channel < 3; channel++) target[to + channel] = Math.round(255 + (data[from + channel]! - 255) * data[from + 3]! / 255)
  }
  return { width: targetWidth, height: targetHeight, data: target }
}
