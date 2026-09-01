import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuestionnaireOverview from '../components/access/QuestionnaireOverview.vue'

const currentQuestionnaire = {
  scaleId: 1,
  title: '运动状态问卷',
  description: '了解最近一段时间的运动感受。',
  checkpoint: 'baseline' as const,
  estimatedMinutes: 3,
  questions: [{
    id: 11,
    prompt: '第一题',
    options: [{ id: 101, label: '符合', score: 1 }]
  }]
}

describe('questionnaire overview', () => {
  it('lists backend questionnaire metadata before starting', async () => {
    const wrapper = mount(QuestionnaireOverview, {
      props: {
        currentQuestionnaire,
        plan: {
          checkpoint: 'baseline',
          scheduled_at: null,
          available: true,
          delay_days: 0,
          is_late: false,
          questionnaire_count: 2,
          completed_questionnaire_count: 0,
          estimated_total_minutes: 7,
          current_questionnaire_id: 1,
          questionnaires: [{
            id: 1,
            code: 'STATE',
            title: '运动状态问卷',
            short_title: '状态',
            description: '了解最近一段时间的运动感受。',
            order: 1,
            estimated_minutes: 3,
            question_count: 8,
            completed: false
          }, {
            id: 2,
            code: 'RECOVERY',
            title: '恢复情况问卷',
            short_title: '恢复',
            description: '记录睡眠和身体恢复情况。',
            order: 2,
            estimated_minutes: 4,
            question_count: 12,
            completed: false
          }]
        }
      }
    })

    expect(wrapper.text()).toContain('开始前，请了解这些')
    expect(wrapper.findAll('.questionnaire-overview__item')).toHaveLength(2)
    expect(wrapper.text()).toContain('记录睡眠和身体恢复情况。')
    expect(wrapper.text()).toContain('12 题')
    expect(wrapper.text()).toContain('约 4 分钟')

    await wrapper.get('.questionnaire-overview__start').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })
})
