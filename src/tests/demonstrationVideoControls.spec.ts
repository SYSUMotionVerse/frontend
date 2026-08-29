import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('centers replay with flex while preserving the speed button line-box layout', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/DemonstrationVideoControls.vue'),
      'utf8'
    )

    expect(source).toMatch(/\.demonstration-video-controls__button\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/)
    expect(source).toMatch(/\.demonstration-video-controls__replay-icon\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/)
    expect(source).toMatch(/\.demonstration-video-controls__button--speed\s*\{[\s\S]*right:\s*0;[\s\S]*display:\s*block;/)
    expect(source).toMatch(/\.demonstration-video-controls__button--speed\s*\{[\s\S]*font-size:\s*19rpx;[\s\S]*line-height:\s*56rpx;/)
    expect(source).toMatch(/\.demonstration-video-controls--compact \.demonstration-video-controls__button--speed\s*\{[\s\S]*line-height:\s*32px;/)
  })
})
