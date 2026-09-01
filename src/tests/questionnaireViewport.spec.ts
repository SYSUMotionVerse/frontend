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

  it('uses the dockless access heading rhythm and removes the first-step top spacer', () => {
    const page = readFileSync(
      resolve('src/uni-app/pages/access/questionnaire.vue'),
      'utf8'
    )
    const progressHeader = readFileSync(
      resolve('src/components/access/QuestionnaireProgressHeader.vue'),
      'utf8'
    )

    expect(page).not.toContain('chip="A2"')
    expect(page).toContain(':show-back="hasStartedQuestionnaire"')
    expect(page).toContain('custom-back')
    expect(page).toContain('@back="returnToQuestionnaireList"')
    expect(page).toContain(':scroll-top="pageScrollTop"')
    expect(page).toContain('heading-inset')
    expect(page).toContain('width: calc(100% - 32rpx);')
    expect(page).toContain('margin: 14rpx 32rpx 0 0;')
    expect(page).toContain('justify-content: flex-start;')
    expect(page).toContain('gap: 8rpx;')
    expect(page).toContain('想先了解什么内容？')
    expect(progressHeader).toMatch(/\.questionnaire-progress__step-group\s*\{[\s\S]*min-height:\s*0;/)
  })

  it('separates the overview from the answering stage', () => {
    const page = readFileSync(
      resolve('src/uni-app/pages/access/questionnaire.vue'),
      'utf8'
    )

    expect(page).toContain('QuestionnaireOverview')
    expect(page).toContain(':show-hero="!hasStartedQuestionnaire"')
    expect(page).toContain('v-show="!hasStartedQuestionnaire"')
    expect(page).toContain('v-show="hasStartedQuestionnaire"')
    expect(page).toContain('@start="startQuestionnaire"')
    expect(page).toContain('hasStartedQuestionnaire.value = false')
  })
})
