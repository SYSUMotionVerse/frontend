import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function sheet(deferCanvas = false, deferRemoval = false) {
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
  let renderCallback: ((rect: { width: number, height: number } | null) => void) | undefined
  const renderedCanvas = () => renderCallback?.(wrapper.find('canvas').exists() ? { width: 319, height: 190 } : null)
  const query = { in: () => query, select: () => query,
    boundingClientRect: (callback: typeof renderCallback) => { renderCallback = callback; return query },
    exec: () => { if (!deferCanvas && !(deferRemoval && !wrapper.find('canvas').exists())) renderedCanvas() } }
  const runtime = { getSystemInfoSync: () => ({ windowWidth: 375 }), createCanvasContext: vi.fn(() => context), createSelectorQuery: () => query,
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
  return { wrapper, context, segments, runtime, touch, write, renderedCanvas }
}

describe('signature sheet', () => {
  it('starts verification only after native view confirms the drawing canvas was removed', async () => {
    const { wrapper, write, renderedCanvas } = await sheet(false, true)
    await write(); await wrapper.get('.signature-done').trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.find('.signature-preview').exists()).toBe(true)
    expect(wrapper.emitted('complete')).toBeUndefined()
    renderedCanvas(); await flushPromises()
    expect(wrapper.emitted('complete')).toHaveLength(1)
    wrapper.unmount()
  })
  it('restores editable strokes after a failed verification without duplicating processing text', async () => {
    const { wrapper, write, segments, runtime } = await sheet()
    await write(); await wrapper.get('.signature-done').trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.find('canvas').exists()).toBe(false)
    await wrapper.setProps({ busy: true }); await wrapper.setProps({ busy: false, error: 'retry' })
    await vi.advanceTimersByTimeAsync(5); await flushPromises()
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(wrapper.find('.signature-preview').exists()).toBe(false)
    expect(runtime.createCanvasContext).toHaveBeenCalledTimes(2)
    expect(segments.at(-1)).toEqual([20, 30, 25, 35])
    await write(80, 90)
    expect(segments.at(-1)).toEqual([80, 90, 85, 95])
    wrapper.unmount()
  })
  it('does not start verification if closed while waiting for canvas removal', async () => {
    const { wrapper, write, renderedCanvas } = await sheet(false, true)
    await write(); await wrapper.get('.signature-done').trigger('click')
    await vi.advanceTimersByTimeAsync(200); await wrapper.setProps({ visible: false })
    renderedCanvas(); await flushPromises()
    expect(wrapper.emitted('complete')).toBeUndefined()
    wrapper.unmount()
  })
  it('waits for the native canvas view before drawing and removes its animated transform', async () => {
    const { wrapper, runtime, renderedCanvas } = await sheet(true)
    expect(wrapper.get('.signature-sheet').classes()).toContain('signature-sheet--ready')
    expect(runtime.createCanvasContext).not.toHaveBeenCalled()
    expect(wrapper.get('.signature-clear').attributes('disabled')).toBeDefined()
    renderedCanvas(); await flushPromises()
    expect(runtime.createCanvasContext).toHaveBeenCalledOnce()
    expect(wrapper.get('.signature-clear').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it.each(['close', 'unmount'])('ignores a late native canvas response after %s', async action => {
    const { wrapper, runtime, renderedCanvas } = await sheet(true)
    if (action === 'close') await wrapper.setProps({ visible: false })
    else wrapper.unmount()
    renderedCanvas(); await flushPromises()
    expect(runtime.createCanvasContext).not.toHaveBeenCalled()
    if (action === 'close') wrapper.unmount()
  })
  it('offers a rewrite after a missing native view response and initializes safely on retry', async () => {
    const { wrapper, runtime, renderedCanvas } = await sheet(true)
    await vi.advanceTimersByTimeAsync(1500)
    expect(runtime.createCanvasContext).not.toHaveBeenCalled()
    expect(wrapper.get('.signature-error').text()).toContain('请点击“重写”')
    await wrapper.get('.signature-clear').trigger('click')
    renderedCanvas(); await flushPromises()
    expect(runtime.createCanvasContext).toHaveBeenCalledOnce()
    expect(wrapper.find('.signature-error').exists()).toBe(false)
    wrapper.unmount()
  })
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
    expect(wrapper.text()).toContain('处理中')
    expect(wrapper.text().match(/处理中…/g)).toHaveLength(1)
    expect(wrapper.get('.signature-done').text()).toBe('处理中…')
    expect(wrapper.text()).not.toMatch(/OCR|图片|超时/)
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
    expect(wrapper.get('.signature-name').text()).toBe('测试')
    expect(wrapper.find('.signature-heading button').exists()).toBe(false)
    await wrapper.get('.signature-sheet').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ busy: true })
    expect(wrapper.text().match(/处理中…/g)).toHaveLength(1)
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
  it('undoes a whole stroke instead of its last segment, and disables undo once empty', async () => {
    const { wrapper, write, touch } = await sheet()
    await write()
    const canvas = wrapper.get('canvas')
    await canvas.trigger('touchstart', touch(80, 90))
    await canvas.trigger('touchmove', touch(85, 93))
    await canvas.trigger('touchmove', touch(100, 100))
    await canvas.trigger('touchend')
    await wrapper.get('.signature-undo').trigger('click')
    await flushPromises()
    const latest = wrapper.emitted('change')!.at(-1)![0] as { strokes: number[][][] }
    expect(latest.strokes).toEqual([[[20, 30, 25, 35]]])
    await wrapper.get('.signature-undo').trigger('click')
    await flushPromises()
    expect(wrapper.get('.signature-undo').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.signature-done').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('restores a signed draft across reopening, can undo it, and does not mutate the original draft', async () => {
    const { wrapper, segments } = await sheet()
    const draft = { width: 319, height: 190, strokes: [[[20, 30, 25, 35] as const], [[80, 90, 85, 93] as const]] }
    await wrapper.setProps({ visible: false, draft })
    await vi.advanceTimersByTimeAsync(240)
    const before = segments.length
    await wrapper.setProps({ visible: true })
    await vi.advanceTimersByTimeAsync(340)
    expect(segments.slice(before)).toEqual([[20, 30, 25, 35], [80, 90, 85, 93]])
    expect(wrapper.get('.signature-done').attributes('disabled')).toBeUndefined()
    await wrapper.get('.signature-undo').trigger('click')
    expect(draft.strokes).toHaveLength(2)
    expect((wrapper.emitted('change')!.at(-1)![0] as { strokes: unknown[] }).strokes).toHaveLength(1)
    wrapper.unmount()
  })
  it('hides raw errors behind a rewrite prompt', async () => {
    const { wrapper } = await sheet()
    await wrapper.setProps({ error: '微信 OCR 超时 errno=123' })
    expect(wrapper.get('.signature-error').text()).toContain('请点击“重写”')
    expect(wrapper.text()).not.toMatch(/OCR|超时|errno/)
    wrapper.unmount()
  })
})
