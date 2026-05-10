import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseCamera overlay display size', () => {
  it('initializes overlay display size from the mounted node rect instead of sampled inference dimensions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(source).toContain('const [{ node: canvasNode, width, height }] = await getNode')
    expect(source).toContain('state.canvasDisplayW = width')
    expect(source).toContain('state.canvasDisplayH = height')
    expect(source).not.toContain('if (!state.canvasDisplayW) {')
    expect(source).not.toContain('if (!state.canvasDisplayH) {')
  })
})
