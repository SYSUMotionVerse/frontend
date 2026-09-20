import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LongQuestionnaireForm from '../components/access/LongQuestionnaireForm.vue'
import type { PsychologyQuestionnaireModel } from '../uni-app/api/studentBackendTypes'

function createMsesQuestionnaire(): PsychologyQuestionnaireModel {
  return {
    scaleId: 91,
    title: '中文版多维度运动自我效能量表（MSES-9）',
    shortTitle: 'MSES-9',
    description: '请选择 0-10 的整数评分。',
    checkpoint: 'baseline',
    questions: [1, 2].map(questionNumber => ({
      id: questionNumber,
      prompt: `MSES-9 第 ${questionNumber} 题`,
      responseConfig: {
        input_type: 'slider',
        min: 0,
        max: 10,
        step: 1
      },
      options: Array.from({ length: 11 }, (_, score) => ({
        id: questionNumber * 100 + score,
        label: String(score),
        score,
        order: score + 1
      }))
    }))
  }
}

describe('MSES-9 slider questionnaire', () => {
  it('renders all 0-10 ticks, maps score zero to its option, and waits for Next', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: { questionnaire: createMsesQuestionnaire() }
    })

    expect(wrapper.findAll('.questionnaire-runner__slider')).toHaveLength(1)
    expect(wrapper.findAll('.questionnaire-runner__slider-tick')).toHaveLength(11)
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 2')

    await wrapper.get('slider').trigger('change', { detail: { value: 0 } })
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 2')
    expect(wrapper.get('.questionnaire-runner__primary').attributes('disabled')).toBeUndefined()

    await wrapper.get('.questionnaire-runner__slider-tick:nth-child(6)').trigger('click')
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 2')
    await wrapper.get('.questionnaire-runner__primary').trigger('click')
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('2 / 2')

    await wrapper.get('.questionnaire-runner__slider-tick:nth-child(11)').trigger('click')
    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      answers: { 1: 105, 2: 210 }
    })
  })

  it('does not submit an untouched slider even though its visual value is zero', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: { questionnaire: createMsesQuestionnaire() }
    })

    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('.questionnaire-runner__primary').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 2')
  })
})
