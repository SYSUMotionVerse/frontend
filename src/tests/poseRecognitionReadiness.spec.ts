import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const controls = vi.hoisted(() => ({
  dispose: vi.fn(),
  loadBlazePose: vi.fn(),
  onStats: vi.fn(),
  startCamera: vi.fn(),
  stopCamera: vi.fn(),
  tfReady: vi.fn(),
  setupWechatPlatform: vi.fn()
}))

const CoverViewStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('cover-view', attrs, slots.default?.())
  }
})

vi.mock('@tensorflow-models/pose-detection/dist/blazepose_tfjs/detector', () => ({
  load: controls.loadBlazePose
}))

vi.mock('@tensorflow/tfjs-core', () => ({
  ready: controls.tfReady
}))

vi.mock('@tensorflow/tfjs-backend-webgl', () => ({}))

vi.mock('../subpackages/training/components/pose/PoseDetectModel', () => ({
  createBlazePoseModelConfig: vi.fn().mockResolvedValue({})
}))

vi.mock('../subpackages/training/components/pose/wechat_platform', () => ({
  setupWechatPlatform: controls.setupWechatPlatform
}))

vi.mock('../subpackages/training/components/pose/fetch', () => ({
  fetchFunc: vi.fn()
}))

vi.mock('../uni-app/components/pose/poseAnalysis', () => ({
  buildPoseAngleFrame: vi.fn()
}))

vi.mock('../subpackages/training/components/pose/PoseCamera.vue', async () => {
  const { defineComponent, h, onMounted } = await import('vue')

  return {
    default: defineComponent({
      props: {
        onStatus: {
          type: Function,
          required: true
        }
      },
      setup(props, { expose }) {
        onMounted(() => {
          ;(props.onStatus as (event: { type: string; detail?: string }) => void)({
            type: 'cameraReady'
          })
        })

        expose({
          startCamera: () => {
            controls.startCamera()
            ;(props.onStatus as (event: { type: string; detail?: string }) => void)({
              type: 'cameraFail',
              detail: 'frame listener failed'
            })
          },
          stopCamera: controls.stopCamera
        })

        return () => h('view', { class: 'pose-camera-stub' })
      }
    })
  }
})

describe('pose recognition readiness', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps recognition failed when the camera frame listener fails after the detector loads', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    controls.loadBlazePose.mockResolvedValue({
      dispose: controls.dispose,
      estimatePoses: vi.fn()
    })
    controls.tfReady.mockResolvedValue(undefined)
    vi.stubGlobal('wx', {
      createOffscreenCanvas: vi.fn(() => ({}))
    })

    const PoseDetectionView = (await import('../subpackages/training/components/pose/PoseDetectionView.vue')).default
    const wrapper = mount(PoseDetectionView, {
      props: {
        onResult: vi.fn(),
        onStats: controls.onStats
      },
      global: {
        stubs: {
          'cover-view': CoverViewStub
        }
      }
    })

    await flushPromises()
    await flushPromises()

    expect(controls.startCamera).toHaveBeenCalledOnce()
    expect(controls.onStats).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
    expect(controls.onStats).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))

    wrapper.unmount()
    consoleWarn.mockRestore()
  })
})
