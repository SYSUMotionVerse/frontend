import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('uni-app manifest source', () => {
  it('keeps one canonical mini-program manifest at the uni CLI source root', () => {
    const canonicalPath = resolve(process.cwd(), 'src/manifest.json')
    const legacyPath = resolve(process.cwd(), 'src/uni-app/manifest.json')
    const manifest = JSON.parse(readFileSync(canonicalPath, 'utf8')) as {
      'mp-weixin'?: {
        appid?: string
        setting?: { urlCheck?: boolean; ignoreDevUnusedFiles?: boolean }
      }
    }

    expect(manifest['mp-weixin']?.appid).toMatch(/^wx[0-9a-fA-F]{16}$/)
    expect(manifest['mp-weixin']?.appid).not.toBe('touristappid')
    expect(manifest['mp-weixin']?.setting?.urlCheck).toBe(true)
    expect(manifest['mp-weixin']?.setting?.ignoreDevUnusedFiles).toBe(false)
    expect(existsSync(legacyPath)).toBe(false)
  })
})
