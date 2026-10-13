import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

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

describe('signature export and recovery', () => {
  async function sheet(stage: 'draw' | 'pixels' | 'image' | 'file' | 'success') {
    vi.useFakeTimers()
    let late!: () => void
    const context = { setFillStyle: vi.fn(), fillRect: vi.fn(), setStrokeStyle: vi.fn(), setLineWidth: vi.fn(),
      setLineCap: vi.fn(), setLineJoin: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      draw: vi.fn((_reserve?: boolean, callback?: () => void) => {
        if (!callback) return
        late = callback
        if (stage !== 'draw') callback()
      }) }
    const canvasGetImageData = vi.fn(options => {
      if (stage === 'pixels') { late = () => options.success({ data: new Uint8ClampedArray(4) }); return }
      options.success({ data: new Uint8ClampedArray(4) })
    })
    vi.stubGlobal('uni', { getSystemInfoSync: () => ({ windowWidth: 375 }), createCanvasContext: () => context,
      canvasGetImageData,
      canvasToTempFilePath: vi.fn(options => { if (stage !== 'image') options.success({ tempFilePath: 'signature.png' }) }),
      getFileSystemManager: () => ({ readFile: vi.fn(options => { if (stage !== 'file') options.success({ data: 'png-base64' }) }) }) })
    const SignatureSheet = (await import('../components/access/SignatureSheet.vue')).default
    const wrapper = mount(SignatureSheet, { props: { visible: true, name: '测试', busy: false, error: '' } })
    await flushPromises()
    const write = async () => {
      await wrapper.get('canvas').trigger('touchstart', { touches: [{ x: 10, y: 10 }] })
      await wrapper.get('canvas').trigger('touchmove', { touches: [{ x: 25, y: 30 }] })
      await wrapper.get('canvas').trigger('touchend')
    }
    await write()
    return { wrapper, context, write, canvasGetImageData, late: () => late() }
  }
  it.each(['draw', 'pixels', 'image', 'file'] as const)('unlocks with a visible error if %s never calls back, and permits rewriting', async stage => {
    const { wrapper, context, write } = await sheet(stage)
    await wrapper.get('.signature-done').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('正在生成签名图片')
    expect(wrapper.get('.signature-done').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(stage === 'draw' ? 3000 : 5000)
    await flushPromises()
    expect(wrapper.get('.signature-error').text()).toMatch(/超时|失败/)
    expect(wrapper.get('.signature-done').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('complete')).toBeUndefined()
    await wrapper.get('.signature-clear').trigger('click')
    const count = context.stroke.mock.calls.length
    await write()
    expect(context.stroke.mock.calls.length).toBe(count + 1)
    expect(wrapper.find('.signature-error').exists()).toBe(false)
    wrapper.unmount()
  })
  it('cancels an in-flight export on rewrite and ignores its late callback', async () => {
    const { wrapper, write, late, canvasGetImageData } = await sheet('draw')
    await wrapper.get('.signature-done').trigger('click')
    await wrapper.get('.signature-clear').trigger('click')
    await write()
    late()
    await flushPromises()
    expect(canvasGetImageData).not.toHaveBeenCalled()
    expect(wrapper.emitted('complete')).toBeUndefined()
    expect(wrapper.get('.signature-done').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('exports the completed strokes and pixels exactly once, including rapid repeated taps', async () => {
    const { wrapper, context } = await sheet('success')
    await wrapper.get('.signature-done').trigger('click')
    await wrapper.get('.signature-done').trigger('click')
    await flushPromises()
    expect(context.draw).toHaveBeenCalledWith(false, expect.any(Function))
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(wrapper.emitted('complete')![0][0]).toMatchObject({ imageBase64: 'png-base64', pixels: { width: 319, height: 190 } })
    wrapper.unmount()
  })
})
