import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuestionnaireBottomNavigation from '../components/access/QuestionnaireBottomNavigation.vue'

describe('QuestionnaireBottomNavigation', () => {
  it('emits submit when the final-answer button is tapped', async () => {
    const wrapper = mount(QuestionnaireBottomNavigation, {
      props: {
        canContinue: true,
        lastQuestion: true,
        submitting: false,
        submitLabel: '提交答案'
      }
    })

    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
