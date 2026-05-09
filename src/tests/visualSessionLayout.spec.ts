import { describe, expect, it } from 'vitest'
import { createVisualSessionLayout } from '../features/training/visualSessionLayout'

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
})
