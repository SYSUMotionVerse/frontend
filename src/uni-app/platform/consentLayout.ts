import type { ConsentField } from '../api/consentTypes'

export function consentFieldStyle(field: ConsentField, pageWidth: number, pageHeight: number, text: string,
  name = '', layout?: Record<string, ConsentField>) {
  const sourceFont = (field.font_size ?? .02016) * pageWidth
  const signature = name === 'participant'
  let boxWidth = field.width * pageWidth
  if (signature) {
    // The next column starts with the printed six-character researcher label.
    // Expand into the gap, never across that label or the edge of the page.
    const next = layout?.researcher
    const labelStart = next && next.page === field.page && next.x > field.x
      ? (next.x - 6 * (next.font_size ?? .02016) - .006) * pageWidth : pageWidth
    boxWidth = Math.max(boxWidth, Math.min(boxWidth * 1.4, labelStart - field.x * pageWidth))
  }
  const originalHeight = field.height * pageHeight
  const boxHeight = Math.max(originalHeight, sourceFont * (signature ? 2.8 : 1.6))
  // Signatures grow upward into the blank space, leaving the date below intact.
  const top = Math.max(0, field.y * pageHeight - (boxHeight - originalHeight) * (signature ? 1 : .5))
  const padding = signature ? 6 : 0 // Includes border and inner padding.
  const units = Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 1 : .6), 0)
  const fontSize = Math.max(1, Math.min(
    sourceFont * (signature ? 1.2 : name === 'researcher' ? 1.12 : 1),
    (boxHeight - padding) / 1.4,
    Math.max(1, boxWidth - padding) / Math.max(1, units)
  ))
  return { left: `${field.x * 100}%`, top: `${top / pageHeight * 100}%`, width: `${boxWidth / pageWidth * 100}%`,
    height: `${boxHeight / pageHeight * 100}%`, fontSize: `${fontSize}px`,
    boxShadow: `0 0 0 ${(field.mask_padding ?? 0) * pageWidth}px #fff` }
}
