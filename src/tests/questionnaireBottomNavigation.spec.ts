import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuestionnaireBottomNavigation from '../components/access/QuestionnaireBottomNavigation.vue'

describe('QuestionnaireBottomNavigation', () => {
  it('emits submit when the final-answer button is tapped', async () => {
    const wrapper = mount(QuestionnaireBottomNavigation, {
      props: {
        canContinue: true,
        canGoBack: true,
        lastQuestion: true,
        submitting: false,
        submitLabel: '提交答案'
      }
    })

    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('keeps both actions visible and disables previous on the first question', () => {
    const wrapper = mount(QuestionnaireBottomNavigation, {
      props: {
        canContinue: false,
        canGoBack: false,
        lastQuestion: false,
        submitting: false,
        submitLabel: '提交答案'
      }
    })

    const actions = wrapper.findAll('.questionnaire-runner__navigation-button')
    expect(actions).toHaveLength(2)
    expect(actions[0].text()).toContain('上一题')
    expect(actions[0].attributes('disabled')).toBeDefined()
    expect(actions[0].classes()).toContain('questionnaire-runner__navigation-button--disabled')
    expect(actions[1].text()).toContain('下一题')
    expect(actions[1].attributes('disabled')).toBeDefined()
    expect(actions[1].classes()).toContain('questionnaire-runner__navigation-button--disabled')
  })

  it('visually disables submit when the final question is unanswered', () => {
    const wrapper = mount(QuestionnaireBottomNavigation, {
      props: {
        canContinue: false,
        canGoBack: true,
        lastQuestion: true,
        submitting: false,
        submitLabel: '提交答案'
      }
    })

    const submit = wrapper.get('.questionnaire-runner__primary')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.classes()).toContain('questionnaire-runner__navigation-button--submit-disabled')
  })
})
