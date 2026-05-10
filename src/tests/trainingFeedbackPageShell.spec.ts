import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('training feedback page shell', () => {
  it('uses the same access-style result shell structure as the questionnaire result page', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(source).toContain("import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'")
    expect(source).toContain('<UniAccessPageShell')
    expect(source).toContain('chip="T3"')
    expect(source).toContain('title="训练反馈"')
    expect(source).toContain('subtitle="本次训练质量评估已生成，请查看结果并继续成长任务。"')
    expect(source).not.toContain('UniTrainingPageShell')
  })
})
