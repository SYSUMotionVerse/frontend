import type { ConsentField } from '../api/consentTypes'

export function consentFieldStyle(field: ConsentField, pageWidth: number, pageHeight: number, text: string) {
  const boxWidth = field.width * pageWidth
  const boxHeight = field.height * pageHeight
  const units = Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 1 : .6), 0)
  const fontSize = Math.max(1, Math.min(
    (field.font_size ?? .02016) * pageWidth,
    boxHeight,
    Math.max(1, boxWidth - 4) / Math.max(1, units)
  ))
  return { left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`,
    height: `${field.height * 100}%`, fontSize: `${fontSize}px`,
    boxShadow: `0 0 0 ${(field.mask_padding ?? 0) * pageWidth}px #fff` }
}
