import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import FloatingDock from '../uni-app/components/navigation/FloatingDock.vue'
import { resolveFloatingDockLayout } from '../uni-app/composables/useFloatingDockLayout'

afterEach(() => {
  vi.unstubAllGlobals()
})

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
    expect(wrapper.findAll('.floating-dock__cell')).toHaveLength(3)
    expect(wrapper.findAll('.floating-dock__cell--divided')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('家')
    expect(wrapper.text()).not.toContain('玩')
  })

  it('stores dock items with shared icon-library metadata instead of short labels', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/navigation/FloatingDock.vue'),
      'utf8'
    )
    const layoutSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/composables/useFloatingDockLayout.ts'),
      'utf8'
    )

    expect(source).toContain("icon: 'home-filled'")
    expect(source).toContain("icon: 'fire-filled'")
    expect(source).toContain("icon: 'medal-filled'")
    expect(source).not.toContain('shortLabel')
    expect(source).toContain('height: 98rpx;')
    expect(source).toContain('padding: 19rpx 2rpx;')
    expect(source).toContain('left: 104rpx;')
    expect(source).toContain('right: 104rpx;')
    expect(layoutSource).toContain('safeAreaInsets?.bottom')
    expect(layoutSource).toContain('windowHeight - windowInfo.safeArea.bottom')
    expect(layoutSource).toContain('const targetTotalBottomPx = baseGapPx + referenceSafeAreaBottomPx')
    expect(layoutSource).toContain('targetTotalBottomPx - safeAreaBottom')
    expect(source).toContain('bottom: calc(var(--floating-dock-bottom-gap, 42px) + env(safe-area-inset-bottom));')
    expect(source).toContain('0 18rpx 38rpx rgba(37, 47, 61, 0.15)')
    expect(source).toContain('background: #ff6f6f;')
    expect(source).toContain('width: 144rpx;')
    expect(source).toContain('height: 56rpx;')
    expect(source).toContain('width: 56rpx;')
    expect(source).toContain('class="floating-dock__glyph"')
    expect(source).toMatch(/\.floating-dock__glyph\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*line-height:\s*1;/)
    expect(source).toContain("'floating-dock__cell'")
    expect(source).toMatch(/\.floating-dock__item\s*\{[\s\S]*align-items:\s*center;[\s\S]*gap:\s*16rpx;/)
    expect(source).toMatch(/\.floating-dock__item--active\s*\{[\s\S]*width:\s*144rpx;[\s\S]*height:\s*56rpx;[\s\S]*justify-content:\s*center;[\s\S]*gap:\s*8rpx;[\s\S]*padding:\s*0;[\s\S]*border-radius:\s*28rpx;[\s\S]*background:\s*#ff6f6f;/)
    expect(source).toMatch(/\.floating-dock__icon--active\s*\{[\s\S]*width:\s*40rpx;[\s\S]*height:\s*56rpx;[\s\S]*background:\s*transparent;/)
    expect(source).not.toContain('.floating-dock__cell:first-child')
    expect(source).not.toContain('.floating-dock__cell:last-child')
    expect(source).not.toContain('flex-direction: column;')
    expect(source).not.toContain('margin: 0 8rpx;')
    expect(source).not.toContain('transform: translateY(2rpx);')
  })

  it('keeps shared ambient decorations fixed to the viewport', () => {
    const shells = [
      'src/uni-app/components/training/UniTrainingPageShell.vue',
      'src/uni-app/components/growth/UniGrowthPageShell.vue',
      'src/uni-app/components/access/UniAccessPageShell.vue'
    ]

    for (const shell of shells) {
      const source = readFileSync(resolve(process.cwd(), shell), 'utf8')
      expect(source).toMatch(/__halo\s*\{[\s\S]*position:\s*fixed;/)
    }
  })

  it('compensates the runtime safe-area inset to keep the same total bottom clearance', async () => {
    const androidLayout = resolveFloatingDockLayout({
      windowWidth: 375,
      windowHeight: 800,
      safeAreaInsets: { bottom: 0 }
    })
    const iosLayout = resolveFloatingDockLayout({
      windowWidth: 375,
      windowHeight: 800,
      safeAreaInsets: { bottom: 34 }
    })
    expect(androidLayout.contentClearancePx).toBe(100)
    expect(iosLayout.contentClearancePx).toBe(100)

    vi.stubGlobal('uni', {
      getWindowInfo: () => ({
        windowWidth: 375,
        windowHeight: 800,
        safeAreaInsets: { bottom: 0 }
      })
    })
    const android = mount(FloatingDock, { props: { activeTab: 'home' } })
    await nextTick()
    expect(android.get('.floating-dock').attributes('style')).toContain('--floating-dock-bottom-gap: 42px')
    android.unmount()

    vi.stubGlobal('uni', {
      getWindowInfo: () => ({
        windowWidth: 375,
        windowHeight: 800,
        safeAreaInsets: { bottom: 34 }
      })
    })
    const ios = mount(FloatingDock, { props: { activeTab: 'home' } })
    await nextTick()
    expect(ios.get('.floating-dock').attributes('style')).toContain('--floating-dock-bottom-gap: 8px')
  })

})
