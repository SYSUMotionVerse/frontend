export interface VisualSessionLayoutInput {
  pageWidth: number
  pageHeight: number
  guideCollapsed: boolean
}

export interface VisualSessionLayout {
  stageHeight: number
  floatAreaWidth: number
  floatAreaHeight: number
  floatWidth: number
  floatHeight: number
  floatX: number
  floatY: number
  videoHeight: number
  guideHeight: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function createVisualSessionLayout({
  pageWidth,
  pageHeight,
  guideCollapsed
}: VisualSessionLayoutInput): VisualSessionLayout {
  const safeWidth = Math.max(pageWidth, 320)
  const safeHeight = Math.max(pageHeight, 568)

  const stageHeight = Math.max(safeHeight - 184, 460)
  const floatAreaWidth = Math.max(safeWidth - 36, 284)
  const floatAreaHeight = Math.max(stageHeight, 300)
  const expandedWidth = clamp(Math.round(floatAreaWidth * 0.54), 184, 208)
  const collapsedWidth = clamp(Math.round(floatAreaWidth * 0.44), 148, 170)
  const floatWidth = guideCollapsed ? collapsedWidth : expandedWidth
  const videoHeight = Math.round(floatWidth * (guideCollapsed ? 0.56 : 0.68))
  const guideHeight = guideCollapsed ? 54 : 118
  const floatHeight = videoHeight + guideHeight + (guideCollapsed ? 20 : 24)

  const maxX = Math.max(floatAreaWidth - floatWidth - 12, 12)
  const maxY = Math.max(floatAreaHeight - floatHeight - 12, 32)

  return {
    stageHeight,
    floatAreaWidth,
    floatAreaHeight,
    floatWidth,
    floatHeight,
    floatX: clamp(Math.round((floatAreaWidth - floatWidth) / 2), 12, maxX),
    floatY: clamp(Math.round(floatAreaHeight * 0.34), 32, maxY),
    videoHeight,
    guideHeight
  }
}
