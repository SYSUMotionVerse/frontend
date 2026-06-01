import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FloatingDock from '../uni-app/components/navigation/FloatingDock.vue'

describe('floating dock', () => {
  it('renders custom glyph icons instead of short text placeholders', () => {
    const wrapper = mount(FloatingDock, {
      global: {
        stubs: {
          block: {
            template: '<div><slot /></div>'
          },
          navigator: {
            template: '<a><slot /></a>'
          }
        }
      },
      props: {
        activeTab: 'playground'
      }
    })

    expect(wrapper.findAll('.floating-dock__glyph')).toHaveLength(3)
    expect(wrapper.find('.floating-dock__item--active').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('家')
    expect(wrapper.text()).not.toContain('玩')
  })

  it('stores dock items with icon metadata instead of short labels', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/navigation/FloatingDock.vue'),
      'utf8'
    )

    expect(source).toContain("icon: 'home'")
    expect(source).toContain("icon: 'spark'")
    expect(source).toContain("icon: 'sprout'")
    expect(source).not.toContain('shortLabel')
  })
})
