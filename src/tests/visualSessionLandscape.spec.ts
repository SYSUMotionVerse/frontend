import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('visual session landscape mode', () => {
  it('allows only the visual training page to follow device orientation', () => {
    const canonicalPages = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/pages.json'), 'utf8')
    )
    const runtimePages = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/uni-app/pages.json'), 'utf8')
    )

    for (const pages of [canonicalPages, runtimePages]) {
      const trainingPackage = pages.subPackages.find(
        (subpackage: { root: string }) => subpackage.root === 'subpackages/training'
      )
      const visualSession = trainingPackage.pages.find(
        (page: { path: string }) => page.path === 'visual-session'
      )

      expect(visualSession.style.pageOrientation).toBe('auto')
      expect(pages.globalStyle.pageOrientation).toBeUndefined()
    }
  })

  it('derives comparison mode from the mini-program window dimensions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/visual-session.vue'),
      'utf8'
    )

    expect(source).toContain("import { onLoad, onResize, onShow } from '@dcloudio/uni-app'")
    expect(source).toContain('createVisualComparisonLayout')
    expect(source).toContain('const orientationReady = shallowRef(false)')
    expect(source).toContain('comparisonMode.value = windowWidth > windowHeight')
    expect(source).toContain('viewport.value = {')
    expect(source).toContain('width: windowWidth')
    expect(source).toContain('height: windowHeight')
    expect(source).toContain('orientationReady.value = true')
    expect(source).toContain('const comparisonMediaSize = computed(() => {')
    expect(source).toContain('safeAreaInsets: viewport.value.safeAreaInsets')
    expect(source).toContain('const comparisonPageStyle = computed(() => {')
    expect(source).toContain('function resolveSafeAreaInsets(')
    expect(source).toContain('safeArea: (windowInfo as { safeArea?: unknown }).safeArea')
    expect(source).toContain('v-if="orientationReady"')
    expect(source).toContain(':comparison-media-size="comparisonMediaSize"')
    expect(source).toContain(':style="comparisonPageStyle"')
    expect(source).toContain('function updateOrientationFromRuntime()')
    expect(source).toMatch(/^\s*updateOrientationFromRuntime\(\)\s*\n\s*onLoad/m)
    expect(source).toContain("if (typeof uni === 'undefined')")
    expect(source).toContain('uni.getSystemInfoSync')
    expect(source).toContain('onShow(updateOrientationFromRuntime)')
    expect(source).toContain(':comparison-mode="comparisonMode"')
    expect(source).toContain("'visual-session-page--comparison': comparisonMode")
    expect(source).toContain('function updateNavigationBarAppearance()')
    expect(source).toContain('uni.setNavigationBarColor')
    expect(source).toContain("frontColor: '#000000'")
    expect(source).toContain("backgroundColor: '#FCF7F0'")
    expect(source).toMatch(
      /\.visual-session-page--comparison\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;[\s\S]*background:\s*#fcf7f0;/
    )
    expect(source).toMatch(
      /\.visual-session-page--comparison\s*\{[\s\S]*box-sizing:\s*border-box;/
    )
  })
})
