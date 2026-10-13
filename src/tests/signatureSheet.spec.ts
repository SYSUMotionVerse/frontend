import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function sheet() {
  vi.useFakeTimers()
  const segments: number[][] = []
  let origin = [0, 0], target = [0, 0]
  const context = {
    setFillStyle: vi.fn(), fillRect: vi.fn(), setStrokeStyle: vi.fn(), setLineWidth: vi.fn(), setLineCap: vi.fn(), setLineJoin: vi.fn(),
    beginPath: () => { origin = [0, 0] }, moveTo: (x: number, y: number) => { origin = [x, y] },
    lineTo: (x: number, y: number) => { target = [x, y] }, stroke: () => segments.push([...origin, ...target]),
    draw: vi.fn(() => { origin = [0, 0] }) // Never calls any callback.
  }
  const forbidden = () => { throw new Error('Native readback/export blocks this device') }
  const runtime = { getSystemInfoSync: () => ({ windowWidth: 375 }), createCanvasContext: () => context,
    canvasGetImageData: vi.fn(forbidden), canvasToTempFilePath: vi.fn(forbidden), getFileSystemManager: vi.fn(forbidden) }
  vi.stubGlobal('uni', runtime)
  const SignatureSheet = (await import('../components/access/SignatureSheet.vue')).default
  const wrapper = mount(SignatureSheet, { props: { visible: true, name: '测试', busy: false, error: '' } })
  await flushPromises()
  await vi.advanceTimersByTimeAsync(340)
  await flushPromises()
  const touch = (x: number, y: number) => ({ touches: [{ x, y }] })
  const write = async (x = 20, y = 30) => {
    await wrapper.get('canvas').trigger('touchstart', touch(x, y))
    await wrapper.get('canvas').trigger('touchmove', touch(x + 5, y + 5))
    await wrapper.get('canvas').trigger('touchend')
  }
  return { wrapper, context, segments, runtime, touch, write }
}

describe('signature sheet', () => {
  it('retains stroke origins after native flushes and separates lifted strokes', async () => {
    const { wrapper, segments, touch } = await sheet()
    const canvas = wrapper.get('canvas')
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
  })
  it('creates a signature when native export APIs would block, without replaying drawing commands', async () => {
    const { wrapper, context, runtime, write } = await sheet()
    await write()
    const draws = context.draw.mock.calls.length
    await wrapper.get('.signature-done').trigger('click')
    await wrapper.get('.signature-done').trigger('click')
    expect(wrapper.text()).toContain('正在生成签名图片')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(wrapper.emitted('complete')![0][0]).toMatchObject({ pixels: { width: 638, height: 380 } })
    expect(context.draw).toHaveBeenCalledTimes(draws)
    expect(runtime.canvasGetImageData).not.toHaveBeenCalled()
    expect(runtime.canvasToTempFilePath).not.toHaveBeenCalled()
    expect(runtime.getFileSystemManager).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('cancels generation on rewrite and permits new strokes and completion', async () => {
    const { wrapper, write } = await sheet()
    await write()
    await wrapper.get('.signature-done').trigger('click')
    await wrapper.get('.signature-clear').trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.emitted('complete')).toBeUndefined()
    await write(80, 90)
    await wrapper.get('.signature-done').trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.emitted('complete')).toHaveLength(1)
    wrapper.unmount()
  })
  it('closes only on an outside tap, including during processing, and has no heading button', async () => {
    const { wrapper } = await sheet()
    expect(wrapper.find('.signature-heading button').exists()).toBe(false)
    await wrapper.get('.signature-sheet').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ busy: true })
    await wrapper.get('.signature-mask').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
  it('retains the sheet during exit animation and safely handles reopening during exit', async () => {
    const { wrapper } = await sheet()
    expect(wrapper.get('.signature-mask').classes()).toContain('signature-mask--open')
    await wrapper.setProps({ visible: false })
    expect(wrapper.find('.signature-mask').exists()).toBe(true)
    expect(wrapper.get('.signature-mask').classes()).not.toContain('signature-mask--open')
    expect(wrapper.find('canvas').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    await wrapper.setProps({ visible: true })
    await vi.advanceTimersByTimeAsync(340)
    await flushPromises()
    expect(wrapper.find('canvas').exists()).toBe(true)
    await wrapper.setProps({ visible: false })
    await vi.advanceTimersByTimeAsync(240)
    expect(wrapper.find('.signature-mask').exists()).toBe(false)
    wrapper.unmount()
  })
  it('ignores completion after the sheet closes', async () => {
    const { wrapper, write } = await sheet()
    await write()
    await wrapper.get('.signature-done').trigger('click')
    await wrapper.setProps({ visible: false })
    await vi.advanceTimersByTimeAsync(240)
    expect(wrapper.emitted('complete')).toBeUndefined()
    wrapper.unmount()
  })
})
