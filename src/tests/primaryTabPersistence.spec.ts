import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pullToRefreshPages = [
  'pages/training/home',
  'pages/training/select',
  'pages/growth/index',
  'pages/growth/adherence',
  'pages/notifications/index',
  'pages/growth/achievements',
  'pages/growth/metrics',
  'pages/growth/history'
]

describe('primary tab persistence and pull-to-refresh', () => {
  it('uses native tab page retention behind the custom floating navigator', () => {
    const pages = JSON.parse(readFileSync(resolve('src/pages.json'), 'utf8'))
    expect(pages.tabBar.custom).toBe(true)
    expect(pages.tabBar.list.map((item: { pagePath: string }) => item.pagePath)).toEqual([
      'pages/training/home',
      'pages/training/select',
      'pages/growth/index'
    ])

    const dock = readFileSync(
      resolve('src/uni-app/components/navigation/FloatingDock.vue'),
      'utf8'
    )
    expect(dock).toContain('open-type="switchTab"')
  })

  it('keeps native page refresh disabled so the indicator can live below the title bar', () => {
    const pages = JSON.parse(readFileSync(resolve('src/pages.json'), 'utf8'))
    const configuredPages = new Map(
      pages.pages.map((page: { path: string, style: Record<string, unknown> }) => [page.path, page.style])
    )

    for (const pagePath of pullToRefreshPages) {
      expect(configuredPages.get(pagePath)).toMatchObject({
        backgroundColor: '#FCF7F0'
      })
      expect(configuredPages.get(pagePath)).not.toHaveProperty('enablePullDownRefresh')
    }
  })

  it('forces request refreshes only for explicit pull gestures', () => {
    const pageSources = pullToRefreshPages.map(pagePath => readFileSync(
      resolve(`src/uni-app/${pagePath}.vue`),
      'utf8'
    ))

    for (const source of pageSources) {
      expect(source).toContain('refresh-enabled')
      expect(source).toContain('@refresh="handlePullDownRefresh"')
      expect(source).toContain('force: true')
      expect(source).toContain('isRefreshing.value = false')
    }

    const trainingProgress = readFileSync(
      resolve('src/uni-app/composables/useTrainingProgress.ts'),
      'utf8'
    )
    const notifications = readFileSync(
      resolve('src/uni-app/composables/useStationNotifications.ts'),
      'utf8'
    )
    const growth = readFileSync(
      resolve('src/uni-app/composables/useGrowthOverview.ts'),
      'utf8'
    )
    expect(trainingProgress).toContain('progressCache.hasValue()')
    expect(notifications).toContain('notificationsCache.hasValue()')
    expect(growth).toContain('growthSectionCaches[section].hasValue()')
  })

  it('places full-width refreshers below the title bar with alpha masks', () => {
    const shells = [
      readFileSync(resolve('src/uni-app/components/training/UniTrainingPageShell.vue'), 'utf8'),
      readFileSync(resolve('src/uni-app/components/growth/UniGrowthPageShell.vue'), 'utf8')
    ]

    for (const shell of shells) {
      expect(shell.indexOf('ImmersiveNavigationBar')).toBeLessThan(
        shell.indexOf('<scroll-view')
      )
      expect(shell).toContain('refresher-enabled')
      expect(shell).toContain('refresher-background="transparent"')
      expect(shell).toContain('__scroll-frame')
      expect(shell).toMatch(/__scroll-frame\s*\{[^}]*width:\s*100%;/)
      expect(shell).toContain('-webkit-mask-image: linear-gradient(')
      expect(shell).toContain('mask-image: linear-gradient(')
      expect(shell).toContain('#000 32rpx')
      expect(shell).not.toContain('#000 48rpx')
      expect(shell).not.toContain('__scroll-fade')
      expect(shell).not.toContain('rgba(252, 247, 240, 0.78)')
      expect(shell).toMatch(/--refreshable[^}]*height:\s*100vh;[^}]*overflow:\s*hidden;/)
      expect(shell).toMatch(/__halo\s*\{[^}]*position:\s*fixed;/)
    }
  })

  it('adds the larger content inset to all four growth detail headings', () => {
    const detailPages = [
      'adherence',
      'achievements',
      'metrics',
      'history'
    ]

    for (const page of detailPages) {
      const source = readFileSync(resolve(`src/uni-app/pages/growth/${page}.vue`), 'utf8')
      expect(source).toMatch(/<UniPageHeading\s+inset/)
    }

    const heading = readFileSync(
      resolve('src/uni-app/components/layout/UniPageHeading.vue'),
      'utf8'
    )
    expect(heading).toMatch(/\.page-heading--inset\s*\{[^}]*margin-top:\s*24rpx;/)
    expect(heading).toMatch(/\.page-heading--inset\s*\{[^}]*margin-left:\s*32rpx;/)
  })

  it('aligns the remaining detail headings and keeps the selection page compact', () => {
    const notifications = readFileSync(
      resolve('src/uni-app/pages/notifications/index.vue'),
      'utf8'
    )
    const stairs = readFileSync(
      resolve('src/components/training/StairTrainingPanel.vue'),
      'utf8'
    )
    const tutorial = readFileSync(
      resolve('src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )
    const achievements = readFileSync(
      resolve('src/uni-app/pages/growth/achievements.vue'),
      'utf8'
    )
    const selection = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )
    const home = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )

    expect(notifications).toMatch(/<UniPageHeading\s+inset/)
    expect(stairs).toMatch(/\.stair-panel__hero-head\s*\{[^}]*margin-top:\s*24rpx;[^}]*margin-left:\s*32rpx;/)
    expect(tutorial).toMatch(/\.visual-session__tutorial-header\s*\{[^}]*margin:\s*24rpx 8rpx 18rpx 32rpx;/)
    expect(achievements).toMatch(/\.achievement-page__summary\s*\{[^}]*margin-left:\s*32rpx;/)
    expect(selection).not.toContain('武术（Wushu）')
    expect(selection).not.toContain('跑楼梯（Stairs）')
    expect(selection).not.toMatch(/\.select-page\s*\{[^}]*min-height:\s*100%;/)
    expect(home).not.toContain('show-reminder-control')
  })

  it('prefetches growth data after the critical home data is ready', () => {
    const home = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const growth = readFileSync(
      resolve('src/uni-app/composables/useGrowthOverview.ts'),
      'utf8'
    )

    expect(home).toContain('prefetchGrowthOverview')
    expect(home).toContain("sections: ['history', 'adherence', 'physicalMetrics', 'awards']")
    expect(growth).toContain('const hasCachedSections')
    expect(growth).not.toContain('refreshOptions.force || loadState.value.status === \'loading\'')
  })
})
