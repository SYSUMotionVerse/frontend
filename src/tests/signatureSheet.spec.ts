import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

describe('signature canvas native path flushing', () => {
  it('connects consecutive points after each draw flush and separates lifted strokes', async () => {
    const segments: number[][] = []
    let origin: number[] = [0, 0]
    let target: number[] = [0, 0]
    const context = {
      setFillStyle: vi.fn(), fillRect: vi.fn(), setStrokeStyle: vi.fn(), setLineWidth: vi.fn(), setLineCap: vi.fn(), setLineJoin: vi.fn(),
      beginPath: () => { origin = [0, 0] },
      moveTo: (x: number, y: number) => { origin = [x, y] },
      lineTo: (x: number, y: number) => { target = [x, y] },
      stroke: () => segments.push([...origin, ...target]),
      draw: () => { origin = [0, 0] }
    }
    vi.stubGlobal('uni', { getSystemInfoSync: () => ({ windowWidth: 375 }), createCanvasContext: () => context })
    const SignatureSheet = (await import('../components/access/SignatureSheet.vue')).default
    const wrapper = mount(SignatureSheet, { props: { visible: false, name: '测试', busy: false, error: '' } })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const canvas = wrapper.get('canvas')
    const touch = (x: number, y: number) => ({ touches: [{ x, y }] })
    await canvas.trigger('touchstart', touch(20, 30))
    await canvas.trigger('touchmove', touch(25, 35))
    await canvas.trigger('touchmove', touch(40, 38))
    await canvas.trigger('touchend')
    await canvas.trigger('touchstart', touch(80, 90))
    await canvas.trigger('touchmove', touch(85, 93))
    await canvas.trigger('touchcancel')
    await canvas.trigger('touchmove', touch(100, 100))
    expect(segments).toEqual([[20, 30, 25, 35], [25, 35, 40, 38], [80, 90, 85, 93]])
    await wrapper.get('.signature-clear').trigger('click')
    await canvas.trigger('touchmove', touch(120, 120))
    expect(segments).toHaveLength(3)
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
