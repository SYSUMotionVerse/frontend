import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShortQuestionnaireForm from '../components/training/ShortQuestionnaireForm.vue'

async function completeCheckIn(wrapper: ReturnType<typeof mount>) {
  const sliders = wrapper.findAll('slider')

  await sliders[0].trigger('change', { detail: { value: 4 } })
  await sliders[1].trigger('change', { detail: { value: 5 } })
}

describe('ShortQuestionnaireForm', () => {
  it('renders four evenly spaced sections with an immediately available submit action', async () => {
    const wrapper = mount(ShortQuestionnaireForm)
    const primaryAction = wrapper.get('button[form-type="submit"]')

    expect(wrapper.findAll('.short-questionnaire-form__question')).toHaveLength(2)
    expect(wrapper.findAll('slider')).toHaveLength(2)
    expect(wrapper.findAll('.short-questionnaire-form__tick')).toHaveLength(17)
    expect(wrapper.findAll('.short-questionnaire-form__tick--selected')).toHaveLength(2)
    expect(wrapper.find('.short-questionnaire-form__question-score').exists()).toBe(false)
    expect(wrapper.find('.short-questionnaire-form__actions').exists()).toBe(false)
    expect(wrapper.find('.short-questionnaire-form__feedback-slot').exists()).toBe(false)
    expect(primaryAction.text()).toContain('提交并查看反馈')
    expect(primaryAction.attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[
      { feelingScale: 0, feltArousalScale: 3 }
    ]])
  })

  it('emits adjusted ratings when either slider is changed', async () => {
    const wrapper = mount(ShortQuestionnaireForm)

    await completeCheckIn(wrapper)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[
      { feelingScale: 4, feltArousalScale: 5}
    ]])
  })

  it('keeps the coral submit action visible with a right-side spinner while saving', async () => {
    const savingWrapper = mount(ShortQuestionnaireForm, {
      props: { submitting: true }
    })

    expect(savingWrapper.text()).toContain('正在提交')
    expect(savingWrapper.find('.short-questionnaire-form__primary-spinner').exists()).toBe(true)
    expect(savingWrapper.find('.short-questionnaire-form__feedback-slot').exists()).toBe(false)
    expect(savingWrapper.get('button[form-type="submit"]').attributes('disabled')).toBeDefined()

    const retryWrapper = mount(ShortQuestionnaireForm, {
      props: {
        status: 'error',
        statusMessage: '反馈保存失败，请重试提交。'
      }
    })
    await completeCheckIn(retryWrapper)

    expect(retryWrapper.find('.short-questionnaire-form__feedback-slot .short-questionnaire-form__status').exists()).toBe(true)
    expect(retryWrapper.text()).toContain('暂未保存')
    expect(retryWrapper.text()).toContain('重新提交反馈')
    expect(retryWrapper.get('button[form-type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('turns a locally saved response into one clear return-home action', async () => {
    const wrapper = mount(ShortQuestionnaireForm, {
      props: {
        status: 'saved-locally',
        statusAction: 'home',
        statusMessage: '反馈已安全保存在本机，网络恢复后将自动重试。'
      }
    })

    const homeAction = wrapper.get('.short-questionnaire-form__primary-action')

    expect(wrapper.text()).toContain('已保存在本机')
    expect(homeAction.text()).toBe('返回训练首页')
    expect(wrapper.findAll('slider')[0].attributes('disabled')).toBeDefined()

    await homeAction.trigger('click')

    expect(wrapper.emitted('goHome')).toHaveLength(1)
  })

  it('moves directly from the loading button to feedback without a saved-message strip', async () => {
    const wrapper = mount(ShortQuestionnaireForm, {
      props: {
        status: 'submitted',
        statusAction: 'feedback',
        statusMessage: '反馈已保存，正在打开训练反馈。'
      }
    })

    const primaryAction = wrapper.get('button[form-type="submit"]')

    expect(wrapper.text()).toContain('正在提交')
    expect(wrapper.find('.short-questionnaire-form__primary-spinner').exists()).toBe(true)
    expect(wrapper.find('.short-questionnaire-form__feedback-slot').exists()).toBe(false)
    expect(wrapper.find('.short-questionnaire-form__handoff').exists()).toBe(false)
    expect(wrapper.find('.short-questionnaire-form__status').exists()).toBe(false)
    expect(primaryAction.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('slider')[0].attributes('disabled')).toBeDefined()
  })

  it('offers a feedback-only recovery action when navigation fails after saving', async () => {
    const wrapper = mount(ShortQuestionnaireForm, {
      props: {
        status: 'error',
        statusAction: 'feedback',
        statusMessage: '反馈已保存，但训练反馈页暂时无法打开。请重新打开。'
      }
    })

    const feedbackAction = wrapper.get('.short-questionnaire-form__primary-action')

    expect(feedbackAction.text()).toBe('重新打开训练反馈')
    expect(wrapper.findAll('slider')[0].attributes('disabled')).toBeDefined()

    await feedbackAction.trigger('click')

    expect(wrapper.emitted('openFeedback')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
