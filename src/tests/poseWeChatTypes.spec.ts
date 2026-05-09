import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('WeChat pose type declarations', () => {
  it('covers the request, image, and offscreen canvas APIs used by the pose spike', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/types/wx.d.ts'),
      'utf8'
    )

    expect(source).toContain('interface RequestSuccessCallbackResult')
    expect(source).toMatch(/getImageInfo\(options:\s*any\):\s*any;/)
    expect(source).toMatch(/getContext\(contextType:\s*'2d'/)
    expect(source).toMatch(/getContext\(contextType:\s*'webgl'/)
    expect(source).toContain('createImage():')
  })
})
