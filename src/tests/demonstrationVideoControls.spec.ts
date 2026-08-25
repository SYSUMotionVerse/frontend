import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import DemonstrationVideoControls from '../subpackages/training/components/DemonstrationVideoControls.vue'

const CoverViewStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('cover-view', attrs, slots.default?.())
  }
})

function mountControls(overrides: Record<string, unknown> = {}) {
  return mount(DemonstrationVideoControls, {
    props: {
      playbackRate: 1,
      ...overrides
    },
    global: {
      stubs: {
        'cover-view': CoverViewStub
      }
    }
  })
}

describe('DemonstrationVideoControls', () => {
  it('keeps only replay and speed shortcuts beside the native video controls', () => {
    const wrapper = mountControls()

    expect(wrapper.findAll('.demonstration-video-controls__button')).toHaveLength(2)
    expect(wrapper.get('.demonstration-video-controls__button--replay').text()).toContain('↺')
    expect(wrapper.text()).toContain('1×')
    expect(wrapper.text()).not.toContain('暂停')
  })

  it('emits replay and cycles through supported mini-program video speeds', async () => {
    const wrapper = mountControls()

    await wrapper.get('.demonstration-video-controls__button').trigger('tap')
    await wrapper.get('.demonstration-video-controls__button--speed').trigger('tap')

    expect(wrapper.emitted('replay')).toHaveLength(1)
    expect(wrapper.emitted('changePlaybackRate')).toEqual([[1.25]])
  })

  it('shows the current playback rate', () => {
    const wrapper = mountControls({ playbackRate: 0.8 })

    expect(wrapper.text()).toContain('0.8×')
  })
})
