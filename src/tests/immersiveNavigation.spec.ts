import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('immersive mini-program navigation', () => {
  function collectVueFiles(directory: string): string[] {
    return readdirSync(resolve(directory), { withFileTypes: true }).flatMap((entry) => {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) return collectVueFiles(path)
      return entry.isFile() && entry.name.endsWith('.vue') ? [path] : []
    })
  }

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
    expect(source).toContain('px - 16rpx)`')
    expect(source).not.toContain("paddingBottom: '16rpx'")
    expect(source).toContain('bottom: -16rpx;')
    expect(source).not.toContain('--immersive-nav-bottom-gap')
    expect(source).not.toContain('box-shadow:')
    expect(source).toContain('if (props.customBack)')
    expect(source).toContain("emit('back')")
  })

  it('keeps the primary-page refreshers below the restored title-bar treatment', () => {
    const shells = [
      'src/uni-app/components/training/UniTrainingPageShell.vue',
      'src/uni-app/components/growth/UniGrowthPageShell.vue'
    ]

    for (const path of shells) {
      const source = readFileSync(resolve(path), 'utf8')
      expect(source.indexOf('<ImmersiveNavigationBar')).toBeLessThan(source.indexOf('<scroll-view'))
      expect(source).toContain('refresher-enabled')
      expect(source).toContain(':refresher-threshold="140"')
      expect(source).not.toContain('--immersive-nav-content-clearance')
    }
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
    expect(feedback).toContain('page-title="训练反馈"')
    expect(feedback).toContain('UniTrainingPageShell')
  })

  it('keeps every route on the shared immersive TitleBar implementation', () => {
    const routeShells = new Map<string, string>([
      ['src/uni-app/pages/access/questionnaire.vue', 'UniAccessPageShell'],
      ['src/uni-app/pages/access/questionnaire-result.vue', 'UniAccessPageShell'],
      ['src/uni-app/pages/access/register.vue', 'UniAccessPageShell'],
      ['src/uni-app/pages/access/reminder-consent.vue', 'UniAccessPageShell'],
      ['src/uni-app/pages/access/startup.vue', 'ImmersiveNavigationBar'],
      ['src/uni-app/pages/training/home.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/training/select.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/training/exercise-sets.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/training/stair-session.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/training/short-questionnaire.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/training/feedback.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/notifications/index.vue', 'UniTrainingPageShell'],
      ['src/uni-app/pages/growth/index.vue', 'UniGrowthPageShell'],
      ['src/uni-app/pages/growth/adherence.vue', 'UniGrowthPageShell'],
      ['src/uni-app/pages/growth/achievements.vue', 'UniGrowthPageShell'],
      ['src/uni-app/pages/growth/metrics.vue', 'UniGrowthPageShell'],
      ['src/uni-app/pages/growth/history.vue', 'UniGrowthPageShell'],
      ['src/subpackages/training/visual-session.vue', 'UniTrainingPageShell']
    ])

    for (const [path, sharedComponent] of routeShells) {
      expect(readFileSync(resolve(path), 'utf8'), path).toContain(sharedComponent)
    }

    const sharedTitleBar = 'src/uni-app/components/layout/ImmersiveNavigationBar.vue'
    const titleBarImplementations = [
      ...collectVueFiles('src/uni-app'),
      ...collectVueFiles('src/subpackages')
    ].filter((path) => {
      const source = readFileSync(resolve(path), 'utf8')
      return source.includes('getMenuButtonBoundingClientRect')
        || source.includes('.immersive-nav__title {')
    })

    expect(titleBarImplementations).toEqual([sharedTitleBar])
  })

  it('uses a non-returning standard registration frame after startup relaunch', () => {
    const startup = readFileSync(resolve('src/uni-app/pages/access/startup.vue'), 'utf8')
    const register = readFileSync(resolve('src/uni-app/pages/access/register.vue'), 'utf8')
    const accessShell = readFileSync(resolve('src/uni-app/components/access/UniAccessPageShell.vue'), 'utf8')
    const manifests = [
      JSON.parse(readFileSync(resolve('src/pages.json'), 'utf8')),
      JSON.parse(readFileSync(resolve('src/uni-app/pages.json'), 'utf8'))
    ]

    expect(startup).toContain('await uni.reLaunch')
    expect(register).toContain(':show-back="false"')
    expect(register).toContain('heading-inset')
    expect(register).toContain('compact-title')
    expect(register).not.toContain('chip="A1"')
    expect(register).toContain("请先完善个人信息\\n注册完成后才能解锁训练。")
    expect(accessShell).toContain('access-entry__hero--inset')
    expect(accessShell).toContain('margin-left: 32rpx;')
    expect(accessShell.indexOf('<ImmersiveNavigationBar')).toBeLessThan(
      accessShell.indexOf('<scroll-view')
    )
    expect(accessShell).toContain('class="access-entry__scroller"')
    expect(accessShell).toContain('scroll-y')
    expect(accessShell).toContain('enable-flex')
    expect(accessShell).toContain(':scroll-top="props.scrollTop"')
    expect(accessShell).toContain('-webkit-mask-image: linear-gradient(')
    expect(accessShell).toContain('mask-image: linear-gradient(')
    expect(accessShell).toContain('height: 100vh;')
    expect(accessShell).toContain('font-size: 36rpx;')
    for (const manifest of manifests) {
      const page = manifest.pages.find((item: { path: string }) => item.path === 'pages/access/register')
      expect(page?.style.navigationStyle).toBe('custom')
      expect(page?.style.backgroundColor).toBe('#FCF7F0')
    }
  })
})
