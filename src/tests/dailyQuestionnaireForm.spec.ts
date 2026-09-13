import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LongQuestionnaireForm from '../components/access/LongQuestionnaireForm.vue'
import QuestionnaireQuestionPanel from '../components/access/QuestionnaireQuestionPanel.vue'
import type { PsychologyQuestionnaireModel } from '../uni-app/api/studentBackendTypes'


const dailyQuestionnaire: PsychologyQuestionnaireModel = {
  scaleId: 90,
  title: '久坐行为每日测量问卷',
  description: '回忆昨天一整天。',
  checkpoint: 'daily',
  questions: [
    {
      id: 1,
      prompt: '昨天的久坐情况',
      questionType: 'TEXT',
      responseConfig: {
        input_type: 'compound',
        fields: [
          { key: 'total_hours', label: '总时长', unit: '小时', min: 0, max: 24, step: 1 },
          { key: 'total_minutes', label: '总时长', unit: '分钟', values: [0, 15, 30, 45] },
          { key: 'screen_percentage', label: '看屏幕比例', unit: '%', min: 0, max: 100, step: 10 },
          { key: 'longest_hours', label: '最长连续久坐', unit: '小时', min: 0, max: 24, step: 1 },
          { key: 'longest_minutes', label: '最长连续久坐', unit: '分钟', values: [0, 15, 30, 45] }
        ]
      },
      options: []
    },
    {
      id: 2,
      prompt: '打断次数',
      responseConfig: {
        input_type: 'single_choice_with_detail',
        detail_option_order: 2,
        detail_label: '请输入实际次数',
        detail_min: 25
      },
      options: [
        { id: 20, label: '0次', score: 0, order: 1 },
        { id: 21, label: '超过24次', score: 25, order: 2 }
      ]
    },
    {
      id: 3,
      prompt: '主要状态',
      questionType: 'SINGLE',
      options: [{ id: 30, label: '没有特殊情况', score: 0, order: 1 }]
    },
    {
      id: 4,
      prompt: '实际睡眠',
      questionType: 'TEXT',
      responseConfig: {
        input_type: 'compound',
        fields: [
          { key: 'hours', label: '实际睡眠', unit: '小时', min: 0, max: 24, step: 1 },
          { key: 'minutes', label: '实际睡眠', unit: '分钟', values: [0, 15, 30, 45] }
        ]
      },
      options: []
    }
  ]
}

describe('daily questionnaire runner', () => {
  it('collapses the definition after the first three completed days and keeps it available', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: {
        questionnaire: dailyQuestionnaire,
        instructionsCollapsible: true,
        instructionsDefaultExpanded: false
      }
    })

    expect(wrapper.text()).not.toContain('回忆昨天一整天。')
    await wrapper.get('.questionnaire-instructions__toggle').trigger('click')
    expect(wrapper.text()).toContain('回忆昨天一整天。')
  })

  it('collects compound dropdowns and required conditional details', async () => {
    const wrapper = mount(LongQuestionnaireForm, {
      props: { questionnaire: dailyQuestionnaire }
    })

    for (const picker of wrapper.findAll('picker')) {
      await picker.trigger('change', { detail: { value: 1 } })
    }
    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    await wrapper.findAll('.questionnaire-runner__option')[1].trigger('click')
    expect(wrapper.text()).toContain('请输入实际次数')
    await wrapper.get('.questionnaire-runner__field--detail input').trigger('input', {
      detail: { value: '27' }
    })
    await wrapper.get('.questionnaire-runner__primary').trigger('click')
    await wrapper.vm.$nextTick()

    wrapper.getComponent(QuestionnaireQuestionPanel).vm.$emit('select', 3, 30)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('实际睡眠')
    for (const picker of wrapper.findAll('picker')) {
      await picker.trigger('change', { detail: { value: 1 } })
    }
    await wrapper.get('.questionnaire-runner__primary').trigger('click')

    const submission = wrapper.emitted('submit')?.[0]?.[0] as {
      answers: Record<number, unknown>
    }
    expect(JSON.parse(submission.answers[1] as string)).toEqual({
      total_hours: 1,
      total_minutes: 15,
      screen_percentage: 10,
      longest_hours: 1,
      longest_minutes: 15
    })
    expect(submission.answers[2]).toEqual({ selectedOptionId: 21, text: '27' })
    expect(JSON.parse(submission.answers[4] as string)).toEqual({ hours: 1, minutes: 15 })
  })
})
