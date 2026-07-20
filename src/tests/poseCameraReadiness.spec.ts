import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PoseCamera from '../uni-app/components/pose/PoseCamera.vue'
import { createComponentContext } from '../uni-app/components/pose/utils'

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
})
