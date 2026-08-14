import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShortQuestionnaireForm from '../components/training/ShortQuestionnaireForm.vue'

async function completeCheckIn(wrapper: ReturnType<typeof mount>) {
  const scores = wrapper.findAll('.short-questionnaire-form__score')

  await scores[3].trigger('click')
  await scores[9].trigger('click')
  await scores[12].trigger('click')
}

describe('ShortQuestionnaireForm', () => {
  it('keeps all three ratings and the disabled primary action in one continuous check-in surface', async () => {
    const wrapper = mount(ShortQuestionnaireForm)
    const primaryAction = wrapper.get('button[form-type="submit"]')

    expect(wrapper.findAll('.short-questionnaire-form__question')).toHaveLength(3)
    expect(wrapper.findAll('.short-questionnaire-form__score')).toHaveLength(15)
    expect(wrapper.text()).toContain('完成 0/3 项后提交')
    expect(primaryAction.attributes('disabled')).toBeDefined()

    await completeCheckIn(wrapper)

    expect(wrapper.text()).toContain('已完成 3/3 项')
    expect(wrapper.text()).toContain('提交并查看反馈')
    expect(primaryAction.attributes('disabled')).toBeUndefined()
  })

  it('emits the selected ratings only after the form is complete', async () => {
    const wrapper = mount(ShortQuestionnaireForm)

    await completeCheckIn(wrapper)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[
      { energyLevel: 4, confidence: 5, enjoyment: 3 }
    ]])
  })

  it('keeps saving and retry states in the same action area', async () => {
    const savingWrapper = mount(ShortQuestionnaireForm, {
      props: { submitting: true }
    })

    expect(savingWrapper.text()).toContain('正在保存反馈…')
    expect(savingWrapper.get('button[form-type="submit"]').attributes('disabled')).toBeDefined()

    const retryWrapper = mount(ShortQuestionnaireForm, {
      props: {
        status: 'error',
        statusMessage: '反馈保存失败，请重试提交。'
      }
    })
    await completeCheckIn(retryWrapper)

    expect(retryWrapper.find('.short-questionnaire-form__actions .short-questionnaire-form__status').exists()).toBe(true)
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
    expect(wrapper.findAll('.short-questionnaire-form__score')[0].attributes('disabled')).toBeDefined()

    await homeAction.trigger('click')

    expect(wrapper.emitted('goHome')).toHaveLength(1)
  })

  it('holds the completed response in a saved state while training feedback opens', async () => {
    const wrapper = mount(ShortQuestionnaireForm, {
      props: {
        status: 'submitted',
        statusAction: 'feedback',
        statusMessage: '反馈已保存，正在打开训练反馈。'
      }
    })

    const primaryAction = wrapper.get('button[form-type="submit"]')

    expect(wrapper.text()).toContain('已保存')
    expect(wrapper.text()).toContain('正在打开训练反馈')
    expect(wrapper.find('.short-questionnaire-form__handoff').exists()).toBe(true)
    expect(wrapper.find('.short-questionnaire-form__status').exists()).toBe(false)
    expect(primaryAction.text()).toContain('正在打开训练反馈')
    expect(primaryAction.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.short-questionnaire-form__score')[0].attributes('disabled')).toBeDefined()
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
    expect(wrapper.findAll('.short-questionnaire-form__score')[0].attributes('disabled')).toBeDefined()

    await feedbackAction.trigger('click')

    expect(wrapper.emitted('openFeedback')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
