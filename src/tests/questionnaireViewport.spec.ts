import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('questionnaire viewport containment', () => {
  it('keeps the questionnaire inside the access page width', () => {
    const page = readFileSync(
      resolve('src/uni-app/pages/access/questionnaire.vue'),
      'utf8'
    )
    const shell = readFileSync(
      resolve('src/uni-app/components/access/UniAccessPageShell.vue'),
      'utf8'
    )

    expect(page).not.toContain('allow-overflow')
    expect(shell).toContain('overflow: hidden;')
    expect(shell).not.toContain('access-entry--allow-overflow')
  })
})
