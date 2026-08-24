// This pure layout helper is owned exclusively by the visual-training subpackage.
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

export interface VisualComparisonLayoutInput {
  pageWidth: number
  pageHeight: number
  safeAreaInsets?: Partial<VisualSessionSafeAreaInsets>
}

export interface VisualComparisonLayout {
  mediaWidth: number
  mediaHeight: number
}

export interface VisualSessionSafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
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

export function createVisualComparisonLayout({
  pageWidth,
  pageHeight,
  safeAreaInsets
}: VisualComparisonLayoutInput): VisualComparisonLayout {
  const pageHorizontalPadding = 32
  const pageVerticalPadding = 28
  const layoutGap = 12
  const actionRailWidth = 112
  const safeAreaLeft = clamp(safeAreaInsets?.left ?? 0, 0, pageWidth)
  const safeAreaRight = clamp(safeAreaInsets?.right ?? 0, 0, pageWidth)
  const safeAreaTop = clamp(safeAreaInsets?.top ?? 0, 0, pageHeight)
  const safeAreaBottom = clamp(safeAreaInsets?.bottom ?? 0, 0, pageHeight)
  const availableWidth = Math.max(0, pageWidth - safeAreaLeft - safeAreaRight)
  const availableHeight = Math.max(0, pageHeight - safeAreaTop - safeAreaBottom)

  const stageWidth = Math.max(
    0,
    availableWidth - pageHorizontalPadding - layoutGap - actionRailWidth
  )
  const mediaAvailableWidth = Math.max(
    0,
    stageWidth - layoutGap
  )
  const maxMediaWidthByHeight = Math.max(
    0,
    Math.floor((availableHeight - pageVerticalPadding) * 3 / 4)
  )
  const mediaWidth = Math.min(
    Math.floor(mediaAvailableWidth / 2),
    maxMediaWidthByHeight
  )

  return {
    mediaWidth,
    mediaHeight: Math.floor(mediaWidth * 4 / 3)
  }
}
