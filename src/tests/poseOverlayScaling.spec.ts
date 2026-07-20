import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PoseCamera overlay scaling', () => {
  it('keeps the overlay visually full-size even when internal sampling resolution is reduced', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/pose/PoseCamera.vue'),
      'utf8'
    )

    expect(source).toContain('canvasDisplayW')
    expect(source).toContain('canvasDisplayH')
    expect(source).toContain("width: state.canvasDisplayW ? state.canvasDisplayW + 'px' : '100%'")
    expect(source).toContain("height: state.canvasDisplayH ? state.canvasDisplayH + 'px' : '100%'")
  })
})
