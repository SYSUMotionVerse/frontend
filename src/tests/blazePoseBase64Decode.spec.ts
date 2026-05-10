import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('BlazePose base64 decoding', () => {
  it('decodes embedded weights in chunks instead of a single atob call', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/model-loader.ts'),
      'utf8'
    )

    expect(source).toMatch(/const chunkChars = \d+/)
    expect(source).toMatch(/for \(let offset = 0; offset < base64\.length; offset \+= chunkChars\)/)
    expect(source).not.toContain("const binaryStr = typeof atob === 'function' ? atob(base64) : ''")
  })
})
