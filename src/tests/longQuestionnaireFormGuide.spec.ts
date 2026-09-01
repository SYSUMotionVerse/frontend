import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LongQuestionnaireForm from '../components/access/LongQuestionnaireForm.vue'
import type { PsychologyQuestionnaireModel } from '../uni-app/api/studentBackendTypes'

const ratingLabels = ['从不', '很少', '有时', '经常', '总是']

function createQuestionnaire(questionCount = 3): PsychologyQuestionnaireModel {
  return {
    scaleId: 12,
    title: '运动心理健康量表',
    description: '了解近期状态',
    checkpoint: 'baseline',
    questions: Array.from({ length: questionCount }, (_, questionIndex) => ({
      id: questionIndex + 1,
      prompt: `第 ${questionIndex + 1} 个问题`,
      options: ratingLabels.map((label, optionIndex) => ({
        id: (questionIndex + 1) * 10 + optionIndex + 1,
        label,
        score: optionIndex + 1
      }))
    }))
  }
}

describe('LongQuestionnaireForm progressive runner', () => {
  it('shows questionnaire duration without repeating the overview introduction', () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(119),
        questionnaireCount: 4,
        estimatedMinutes: 18
      }
    })

    expect(wrapper.text()).toContain('全程约 18 分钟')
    expect(wrapper.text()).not.toContain('开始前，请了解这些')
    expect(wrapper.text()).toContain('已完成 0 / 119 题')
    expect(wrapper.findAll('.questionnaire-question')).toHaveLength(1)
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 119')
    expect(wrapper.text()).toContain('第 1 个问题')
    expect(wrapper.text()).not.toContain('第 2 个问题')
    expect(wrapper.findAll('.questionnaire-runner__block--spaced')).toHaveLength(3)
  })

  it('shows completed questions across all questionnaires instead of the local question number', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(3),
        completedQuestionCountBefore: 10,
        totalQuestionCount: 24,
        initialAnswers: { 1: 11 }
      }
    })

    expect(wrapper.get('.questionnaire-progress__detail').text()).toContain('已完成 11 / 24 题')
    expect(wrapper.get('.questionnaire-progress__detail').text()).toContain('46%')
    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 3')

    await wrapper.findAll('.questionnaire-runner__option')[1].trigger('click')
    expect(wrapper.get('.questionnaire-progress__detail').text()).toContain('已完成 11 / 24 题')
    await wrapper.get('.questionnaire-runner__primary').trigger('click')
    await wrapper.findAll('.questionnaire-runner__option')[0].trigger('click')
    expect(wrapper.get('.questionnaire-progress__detail').text()).toContain('已完成 12 / 24 题')
    expect(wrapper.get('.questionnaire-progress__detail').text()).toContain('50%')
  })

  it('renders the exact backend 1–5 legend in a compact row and saves after each answer and navigation step', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire()
      }
    })

    expect(wrapper.findAll('.questionnaire-instructions__legend-item').map(item => item.text()))
      .toEqual(['1=从不', '2=很少', '3=有时', '4=经常', '5=总是'])

    await wrapper.findAll('.questionnaire-runner__option')[2].trigger('click')
    expect(wrapper.emitted('draftChange')?.[0]).toEqual([{
      answers: { 1: 13, 2: 0, 3: 0 },
      currentQuestionIndex: 0
    }])

    await wrapper.get('.questionnaire-runner__primary').trigger('click')
    expect(wrapper.text()).toContain('第 2 个问题')
    expect(wrapper.text()).not.toContain('第 1 个问题')
    expect(wrapper.emitted('draftChange')?.at(-1)).toEqual([{
      answers: { 1: 13, 2: 0, 3: 0 },
      currentQuestionIndex: 1
    }])
  })

  it('restores a draft and submits the original backend option identifiers', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(2),
        initialAnswers: { 1: 15, 2: 24 },
        initialQuestionIndex: 1,
        submitLabel: '完成评估'
      }
    })

    expect(wrapper.text()).toContain('第 2 个问题')
    expect(wrapper.get('.questionnaire-runner__option--selected').text()).toContain('经常')

    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[
      {
        scaleId: 12,
        answers: {
          1: 15,
          2: 24
        },
        title: '运动心理健康量表'
      }
    ]])
  })

  it('keeps a visible question when the current questionnaire is refreshed with fewer questions', async () => {
    const questionnaire = createQuestionnaire(3)
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire,
        initialQuestionIndex: 2
      }
    })

    expect(wrapper.text()).toContain('第 3 个问题')

    await wrapper.setProps({
      questionnaire: {
        ...questionnaire,
        questions: questionnaire.questions.slice(0, 1)
      }
    })

    expect(wrapper.findAll('.questionnaire-question')).toHaveLength(1)
    expect(wrapper.text()).toContain('第 1 个问题')
  })

  it('resets to question one when the next questionnaire replaces the current one', async () => {
    const firstQuestionnaire = createQuestionnaire(10)
    const nextQuestionnaire = {
      ...createQuestionnaire(11),
      scaleId: 13,
      title: '下一份问卷',
      questions: createQuestionnaire(11).questions.map((question, index) => ({
        ...question,
        id: index + 101,
        prompt: `新问卷第 ${index + 1} 题`
      }))
    }
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: firstQuestionnaire,
        initialQuestionIndex: 9
      }
    })

    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('10 / 10')

    await wrapper.setProps({
      questionnaire: nextQuestionnaire,
      initialQuestionIndex: 0,
      initialAnswers: {}
    })

    expect(wrapper.get('.questionnaire-question__progress').text()).toBe('1 / 11')
    expect(wrapper.text()).toContain('新问卷第 1 题')
    expect(wrapper.text()).not.toContain('新问卷第 11 题')
  })

  it('shows a recoverable state instead of a blank runner when no questions are available', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: { questionnaire: createQuestionnaire(0) }
    })

    expect(wrapper.find('.questionnaire-runner__empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂时没有可作答的题目')

    await wrapper.get('.questionnaire-runner__empty-retry').trigger('click')

    expect(wrapper.emitted('reload')).toHaveLength(1)
  })

  it('supports multi-select questions and submits every selected option', async () => {
    const questionnaire = createQuestionnaire(1)
    questionnaire.questions[0].questionType = 'MULTIPLE'
    const wrapper = mount(LongQuestionnaireForm, { props: { questionnaire } })

    await wrapper.findAll('.questionnaire-runner__option')[0].trigger('click')
    await wrapper.findAll('.questionnaire-runner__option')[1].trigger('click')

    expect(wrapper.findAll('.questionnaire-runner__option--selected')).toHaveLength(2)
    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      answers: { 1: [11, 12] }
    })
  })

  it('jumps directly to the first unanswered item instead of forcing a manual search', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(3),
        initialAnswers: { 1: 11, 3: 31 },
        initialQuestionIndex: 2
      }
    })

    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.text()).toContain('第 2 个问题')
    expect(wrapper.text()).toContain('还有未完成的题目，已为你定位到第一道未答题')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('draftChange')?.at(-1)).toEqual([{
      answers: { 1: 11, 2: 0, 3: 31 },
      currentQuestionIndex: 1
    }])
  })

  it('keeps the study introduction out of the answering runner', () => {
    const first = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(),
        questionnaireNumber: 1,
        questionnaireCount: 10
      }
    })
    const later = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(),
        questionnaireNumber: 2,
        questionnaireCount: 10
      }
    })

    expect(first.find('.questionnaire-runner__introduction').exists()).toBe(false)
    expect(later.find('.questionnaire-runner__introduction').exists()).toBe(false)
  })

  it('keeps next visible but disabled until an answer is selected', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: { questionnaire: createQuestionnaire() }
    })

    expect(wrapper.find('.questionnaire-runner__footer').exists()).toBe(true)
    expect(wrapper.get('.questionnaire-runner__primary').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.questionnaire-runner__primary').classes())
      .toContain('questionnaire-runner__navigation-button--disabled')
    await wrapper.find('.questionnaire-runner__option').trigger('click')
    expect(wrapper.get('.questionnaire-runner__footer').text()).toContain('下一题')
    expect(wrapper.get('.questionnaire-runner__primary').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.questionnaire-runner__primary').classes())
      .not.toContain('questionnaire-runner__navigation-button--disabled')
    expect(wrapper.text()).not.toContain('已保存在本机')
  })

  it('uses the paired previous control below the question', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: createQuestionnaire(2),
        initialAnswers: { 1: 11, 2: 24 },
        initialQuestionIndex: 1
      }
    })

    const previous = wrapper.findAll('.questionnaire-runner__navigation-button')[0]
    expect(previous.text()).toContain('上一题')
    expect(previous.attributes('disabled')).toBeUndefined()
    await previous.trigger('click')
    expect(wrapper.text()).toContain('第 1 个问题')
  })

  it('visually disables previous on the first question', () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: { questionnaire: createQuestionnaire(2) }
    })

    const previous = wrapper.findAll('.questionnaire-runner__navigation-button')[0]
    expect(previous.attributes('disabled')).toBeDefined()
    expect(previous.classes()).toContain('questionnaire-runner__navigation-button--disabled')
  })

  it('preserves GPAQ duration inputs and follows reviewed skip logic', async () => {
    const questionnaire: PsychologyQuestionnaireModel = {
      scaleId: 20,
      title: 'GPAQ',
      description: '身体活动',
      instructions: '请按通常一周的实际情况作答。',
      checkpoint: 'baseline',
      questions: [
        {
          id: 1,
          sourceOrder: 1,
          prompt: '工作中是否有剧烈活动？',
          responseConfig: { input_type: 'yes_no', skip_to_on_no: 'P4' },
          options: [
            { id: 11, label: '是', score: 1 },
            { id: 12, label: '否', score: 0 }
          ]
        },
        {
          id: 2,
          sourceOrder: 2,
          prompt: '每周几天？',
          questionType: 'TEXT',
          responseConfig: { input_type: 'integer', unit: '天' },
          options: []
        },
        {
          id: 3,
          sourceOrder: 3,
          prompt: '每天多久？',
          questionType: 'TEXT',
          responseConfig: { input_type: 'duration' },
          options: []
        },
        {
          id: 4,
          sourceOrder: 4,
          prompt: '工作中是否有中等强度活动？',
          responseConfig: { input_type: 'yes_no' },
          options: [
            { id: 41, label: '是', score: 1 },
            { id: 42, label: '否', score: 0 }
          ]
        }
      ]
    }
    const wrapper = mount(LongQuestionnaireForm, { props: { questionnaire } })

    await wrapper.findAll('.questionnaire-runner__option')[1].trigger('click')
    await wrapper.get('.questionnaire-runner__primary').trigger('click')
    expect(wrapper.text()).toContain('工作中是否有中等强度活动？')
    expect(wrapper.text()).not.toContain('每周几天？')

    await wrapper.findAll('.questionnaire-runner__option')[0].trigger('click')
    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      answers: { 1: 12, 4: 41 }
    })
  })
})
