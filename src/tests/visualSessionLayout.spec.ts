import { describe, expect, it } from 'vitest'
import {
  createVisualComparisonLayout,
  createVisualSessionLayout
} from '../subpackages/training/visualSessionLayout'

describe('createVisualSessionLayout', () => {
  it('creates a narrower floating card on typical phone screens', () => {
    const layout = createVisualSessionLayout({
      pageWidth: 393,
      pageHeight: 852,
      guideCollapsed: false
    })

    expect(layout.stageHeight).toBeGreaterThan(520)
    expect(layout.floatAreaWidth).toBe(357)
    expect(layout.floatWidth).toBeGreaterThanOrEqual(184)
    expect(layout.floatWidth).toBeLessThanOrEqual(208)
    expect(layout.floatX).toBeGreaterThan(70)
    expect(layout.floatY).toBeGreaterThan(120)
    expect(layout.floatHeight).toBeGreaterThan(layout.videoHeight)
  })

  it('makes the collapsed floating card visibly narrower and shorter', () => {
    const expanded = createVisualSessionLayout({
      pageWidth: 375,
      pageHeight: 667,
      guideCollapsed: false
    })
    const collapsed = createVisualSessionLayout({
      pageWidth: 375,
      pageHeight: 667,
      guideCollapsed: true
    })

    expect(collapsed.floatAreaWidth).toBe(expanded.floatAreaWidth)
    expect(collapsed.floatAreaHeight).toBe(expanded.floatAreaHeight)
    expect(collapsed.floatWidth).toBeLessThan(expanded.floatWidth)
    expect(collapsed.floatHeight).toBeLessThan(expanded.floatHeight)
    expect(collapsed.guideHeight).toBeLessThan(expanded.guideHeight)
  })

  it('keeps the whole training page within a one-screen height budget on shorter devices', () => {
    const layout = createVisualSessionLayout({
      pageWidth: 375,
      pageHeight: 667,
      guideCollapsed: false
    })

    expect(layout.stageHeight).toBeLessThanOrEqual(490)
    expect(layout.stageHeight).toBeGreaterThanOrEqual(460)
    expect(layout.floatHeight).toBeLessThan(layout.floatAreaHeight)
  })

  it('lets the floating card drag close to the bottom edge of the stage', () => {
    const layout = createVisualSessionLayout({
      pageWidth: 375,
      pageHeight: 667,
      guideCollapsed: false
    })

    expect(layout.floatAreaHeight).toBe(layout.stageHeight)
    expect(layout.floatAreaHeight - layout.floatHeight).toBeGreaterThanOrEqual(130)
  })

  it('does not cap the stage height on tall screens, so the floating card can keep moving down', () => {
    const layout = createVisualSessionLayout({
      pageWidth: 393,
      pageHeight: 852,
      guideCollapsed: false
    })

    expect(layout.stageHeight).toBeGreaterThan(620)
    expect(layout.floatAreaHeight).toBe(layout.stageHeight)
    expect(layout.floatAreaHeight - layout.floatHeight).toBeGreaterThanOrEqual(300)
  })

  it('keeps both landscape comparison views at a 3:4 ratio on a 4:3 tablet', () => {
    const layout = createVisualComparisonLayout({
      pageWidth: 1024,
      pageHeight: 768
    })

    expect(layout.mediaWidth).toBe(428)
    expect(layout.mediaHeight).toBe(570)
    expect(layout.mediaHeight / layout.mediaWidth).toBeCloseTo(4 / 3, 2)
  })

  it('uses the available height instead of stretching portrait frames on a wide phone', () => {
    const layout = createVisualComparisonLayout({
      pageWidth: 844,
      pageHeight: 390
    })

    expect(layout.mediaWidth).toBe(271)
    expect(layout.mediaHeight).toBe(361)
    expect(layout.mediaHeight).toBeLessThanOrEqual(390 - 28)
  })

  it('keeps both media frames within a compact landscape phone viewport', () => {
    const layout = createVisualComparisonLayout({
      pageWidth: 568,
      pageHeight: 320
    })

    expect(layout.mediaWidth).toBe(200)
    expect(layout.mediaHeight).toBe(266)
    expect(layout.mediaHeight).toBeLessThanOrEqual(320 - 28)
  })

  it('reserves landscape safe-area insets before sizing the comparison frames', () => {
    const layout = createVisualComparisonLayout({
      pageWidth: 568,
      pageHeight: 320,
      safeAreaInsets: {
        left: 24,
        right: 24,
        top: 0,
        bottom: 16
      }
    })

    expect(layout.mediaWidth).toBe(176)
    expect(layout.mediaHeight).toBe(234)
    expect(layout.mediaHeight).toBeLessThanOrEqual(320 - 16 - 28)
  })

  it('never produces a negative media frame when safe areas consume the viewport', () => {
    const layout = createVisualComparisonLayout({
      pageWidth: 120,
      pageHeight: 80,
      safeAreaInsets: {
        left: 60,
        right: 60,
        top: 40,
        bottom: 40
      }
    })

    expect(layout).toEqual({ mediaWidth: 0, mediaHeight: 0 })
  })
})
