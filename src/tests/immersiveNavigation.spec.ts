import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('immersive mini-program navigation', () => {
  it('uses custom navigation across every mini-program route', () => {
    const pages = JSON.parse(readFileSync(resolve('src/pages.json'), 'utf8'))
    expect(pages.globalStyle.navigationStyle).toBe('custom')
  })

  it('reads the native capsule bounds and preserves a symmetric title clearance', () => {
    const source = readFileSync(
      resolve('src/uni-app/components/layout/ImmersiveNavigationBar.vue'),
      'utf8'
    )

    expect(source).toContain('getMenuButtonBoundingClientRect')
    expect(source).toContain('--immersive-nav-side-clearance')
    expect(source).toContain('left: var(--immersive-nav-side-clearance);')
    expect(source).toContain('right: var(--immersive-nav-side-clearance);')
    expect(source).toContain('background: transparent;')
    expect(source).not.toContain('--immersive-nav-bottom-gap')
    expect(source).not.toContain('box-shadow:')
  })

  it('wires the shared navigation into every page shell and standalone page', () => {
    const accessShell = readFileSync(resolve('src/uni-app/components/access/UniAccessPageShell.vue'), 'utf8')
    const trainingShell = readFileSync(resolve('src/uni-app/components/training/UniTrainingPageShell.vue'), 'utf8')
    const growthShell = readFileSync(resolve('src/uni-app/components/growth/UniGrowthPageShell.vue'), 'utf8')
    const startup = readFileSync(resolve('src/uni-app/pages/access/startup.vue'), 'utf8')
    const feedback = readFileSync(resolve('src/uni-app/pages/training/feedback.vue'), 'utf8')

    expect(accessShell).toContain('ImmersiveNavigationBar')
    expect(trainingShell).toContain('ImmersiveNavigationBar')
    expect(growthShell).toContain('ImmersiveNavigationBar')
    expect(startup).toContain('<ImmersiveNavigationBar title="运动零食" />')
    expect(startup).toContain('每天一点，动出好状态')
    expect(startup).toContain('正在准备今日训练')
    expect(feedback).toContain('<ImmersiveNavigationBar title="训练反馈" show-back />')
  })
})
