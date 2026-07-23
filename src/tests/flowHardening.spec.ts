import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('critical flow hardening', () => {
  it('invalidates authoritative progress and growth caches after stair completion', () => {
    const source = readSource('src/uni-app/pages/training/stair-session.vue')

    expect(source).toContain('useTrainingProgress().invalidate()')
    expect(source).toContain('invalidateGrowthOverview()')
  })

  it('keeps the two mini-program route manifests aligned for startup and notifications', () => {
    const rootManifest = readSource('src/pages.json')
    const legacyManifest = readSource('src/uni-app/pages.json')

    for (const route of ['pages/access/startup', 'pages/notifications/index']) {
      expect(rootManifest).toContain(`"path": "${route}"`)
      expect(legacyManifest).toContain(`"path": "${route}"`)
    }
  })
})
