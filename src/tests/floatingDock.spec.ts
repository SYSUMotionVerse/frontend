import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FloatingDock from '../uni-app/components/navigation/FloatingDock.vue'

describe('floating dock', () => {
  it('renders shared uni-icons instead of short text placeholders', () => {
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

    expect(wrapper.findAllComponents({ name: 'UniIcons' })).toHaveLength(3)
    expect(wrapper.find('.floating-dock__item--active').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('家')
    expect(wrapper.text()).not.toContain('玩')
  })

  it('stores dock items with shared icon-library metadata instead of short labels', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/navigation/FloatingDock.vue'),
      'utf8'
    )

    expect(source).toContain("icon: 'home-filled'")
    expect(source).toContain("icon: 'fire-filled'")
    expect(source).toContain("icon: 'medal-filled'")
    expect(source).not.toContain('shortLabel')
  })

})
