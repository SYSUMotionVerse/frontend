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
    expect(source).toContain('comparisonMode.value = windowWidth > windowHeight')
    expect(source).toContain('function updateOrientationFromRuntime()')
    expect(source).toContain('uni.getSystemInfoSync')
    expect(source).toContain('onShow(updateOrientationFromRuntime)')
    expect(source).toContain(':comparison-mode="comparisonMode"')
  })
})
