import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PoseCamera from '../subpackages/training/components/pose/PoseCamera.vue'
import { createComponentContext } from '../subpackages/training/components/pose/utils'

describe('PoseCamera native readiness', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for camera initdone when recording is requested immediately', async () => {
    const startRecord = vi.fn(({ success }: { success: () => void }) => success())
    const createCameraContext = vi.fn(() => ({
      startRecord,
      onCameraFrame: vi.fn()
    }))

    vi.stubGlobal('wx', { createCameraContext })
    vi.stubGlobal('uni', {
      createSelectorQuery: vi.fn(() => ({
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        fields: vi.fn().mockReturnThis(),
        exec: vi.fn((callback: (result: unknown[]) => void) => callback([]))
      }))
    })

    const wrapper = mount(PoseCamera, {
      props: {
        onFrame: vi.fn()
      }
    })
    const recording = (wrapper.vm as unknown as { startRecord: () => Promise<void> }).startRecord()

    await wrapper.get('camera').trigger('initdone', {
      detail: { maxZoom: 1 }
    })

    await expect(recording).resolves.toBeUndefined()
    expect(createCameraContext).toHaveBeenCalledOnce()
    expect(startRecord).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('defers the realtime frame listener until the native camera is ready', async () => {
    const listener = {
      start: vi.fn(({ success }: { success: () => void }) => success()),
      stop: vi.fn()
    }
    const onCameraFrame = vi.fn(() => listener)
    const createCameraContext = vi.fn(() => ({ onCameraFrame }))

    vi.stubGlobal('wx', { createCameraContext })
    vi.stubGlobal('uni', {
      createSelectorQuery: vi.fn(() => ({
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        fields: vi.fn().mockReturnThis(),
        exec: vi.fn((callback: (result: unknown[]) => void) => callback([]))
      }))
    })

    const wrapper = mount(PoseCamera, {
      props: {
        onFrame: vi.fn()
      }
    })
    const camera = wrapper.vm as unknown as { startCamera: () => void }

    camera.startCamera()
    expect(createCameraContext).not.toHaveBeenCalled()

    await wrapper.get('camera').trigger('initdone', {
      detail: { maxZoom: 1 }
    })

    expect(createCameraContext).toHaveBeenCalledOnce()
    expect(onCameraFrame).toHaveBeenCalledOnce()
    expect(listener.start).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('stops a pending frame listener when the component unmounts', async () => {
    const listener = {
      start: vi.fn(),
      stop: vi.fn()
    }
    const createCameraContext = vi.fn(() => ({
      onCameraFrame: vi.fn(() => listener)
    }))

    vi.stubGlobal('wx', { createCameraContext })
    vi.stubGlobal('uni', {
      createSelectorQuery: vi.fn(() => ({
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        fields: vi.fn().mockReturnThis(),
        exec: vi.fn((callback: (result: unknown[]) => void) => callback([]))
      }))
    })

    const wrapper = mount(PoseCamera, {
      props: {
        onFrame: vi.fn()
      }
    })
    const camera = wrapper.vm as unknown as { startCamera: () => void }

    await wrapper.get('camera').trigger('initdone', {
      detail: { maxZoom: 1 }
    })
    camera.startCamera()

    expect(listener.start).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(listener.stop).toHaveBeenCalledOnce()
  })

  it('binds the CameraContext factory to the native custom-component scope', () => {
    const nativeComponentScope = { id: 'pose-camera-native-scope' }
    const createCameraContext = vi.fn(() => ({ id: 'camera-context' }))

    const context = createComponentContext(
      { $scope: nativeComponentScope },
      createCameraContext
    )

    expect(createCameraContext).toHaveBeenCalledWith(nativeComponentScope)
    expect(context).toEqual({ id: 'camera-context' })
  })

  it('binds an explicit measured size to the native camera and overlay canvas', async () => {
    vi.stubGlobal('wx', {
      createSelectorQuery: vi.fn(() => ({
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        fields: vi.fn().mockReturnThis(),
        exec: vi.fn((callback: (result: unknown[]) => void) => callback([]))
      }))
    })

    const wrapper = mount(PoseCamera, {
      props: {
        onFrame: vi.fn(),
        mediaSize: { width: 336, height: 448 }
      }
    })
    await flushPromises()

    expect(wrapper.get('camera').attributes('style')).toContain('width: 336px')
    expect(wrapper.get('camera').attributes('style')).toContain('height: 448px')
    expect(wrapper.get('#pose-canvas').attributes('style')).toContain('width: 336px')
    expect(wrapper.get('#pose-canvas').attributes('style')).toContain('height: 448px')

    wrapper.unmount()
  })

  it('does not resize the native overlay canvas again when frame dimensions are unchanged', async () => {
    let canvasWidth = 0
    let canvasHeight = 0
    const setCanvasWidth = vi.fn((value: number) => { canvasWidth = value })
    const setCanvasHeight = vi.fn((value: number) => { canvasHeight = value })
    const clearRect = vi.fn()
    const overlayCanvas = {
      get width() { return canvasWidth },
      set width(value: number) { setCanvasWidth(value) },
      get height() { return canvasHeight },
      set height(value: number) { setCanvasHeight(value) },
      getContext: vi.fn(() => ({ clearRect }))
    }
    const selectorQuery = {
      in: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      fields: vi.fn().mockReturnThis(),
      exec: vi.fn((callback: (result: unknown[]) => void) => callback([
        { node: overlayCanvas, width: 320, height: 480 }
      ]))
    }

    vi.stubGlobal('wx', {
      createSelectorQuery: vi.fn(() => selectorQuery)
    })

    const wrapper = mount(PoseCamera, {
      props: {
        onFrame: vi.fn()
      }
    })
    await flushPromises()

    const camera = wrapper.vm as unknown as {
      setOverlayFrame: (width: number, height: number) => void
    }
    camera.setOverlayFrame(192, 144)
    camera.setOverlayFrame(192, 144)

    expect(setCanvasWidth).toHaveBeenCalledTimes(1)
    expect(setCanvasHeight).toHaveBeenCalledTimes(1)
    expect(clearRect).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })
})
