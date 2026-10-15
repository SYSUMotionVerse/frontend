import { shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import TrainingHomeProgressOverview from '../components/training/TrainingHomeProgressOverview.vue'
import { describe, expect, it } from 'vitest'
import { mapTrainingProgress } from '../uni-app/api/trainingProgressModels'
import { useTrainingHomeProgressViewModel } from '../uni-app/composables/useTrainingHomeProgressViewModel'
import type { TrainingProgressState } from '../uni-app/composables/useTrainingProgress'

function progressState(count: number) {
  return shallowRef<TrainingProgressState>({ status: 'ready', progress: mapTrainingProgress({
    date: '2026-10-15', daily_count: count, daily_target: 3, weekly_target_days: 3,
    distinct_daily_count: 1, daily_goal_completed: count >= 3,
    modalities: [{ modality: 'HIIT', completed: true, completion_count: count }],
    week: { start_date: '2026-10-12', end_date: '2026-10-18', qualifying_day_count: 1 }
  }) })
}

describe('repeated permitted training progress', () => {
  it('marks the actual qualifying weekdays rather than inventing dates from their count', () => {
    const wrapper = mount(TrainingHomeProgressOverview, { props: {
      completedCount: 4, totalCount: 3, goalCompleted: true, weekQualifyingDayCount: 3,
      weekQualifyingDates: ['2026-10-12', '2026-10-13', '2026-10-15']
    } })
    expect(wrapper.text()).toContain('4 / 3')
    expect(wrapper.findAll('.home-progress__weekday-dot').map(dot =>
      dot.classes().includes('home-progress__weekday-dot--done')
    )).toEqual([true, true, false, true, false, false, false])
  })

  it('uses the number of sessions rather than the number of different modalities', () => {
    const view = useTrainingHomeProgressViewModel({ progressState: progressState(2) })
    expect(view.reminderLabel.value).toBe('今日已完成 2/3')
    expect(view.completedQuestCount.value).toBe(2)
    expect(view.progress.value?.dailyTarget).toBe(3)
    expect(view.quests.value[0]).toMatchObject({ id: 'hiit', highlight: true })
  })

  it('finishes the goal at three sessions and preserves additional training counts', () => {
    for (const count of [3, 4]) {
      const view = useTrainingHomeProgressViewModel({ progressState: progressState(count) })
      expect(view.progress.value?.goalCompleted).toBe(true)
      expect(view.completedQuestCount.value).toBe(count)
      expect(view.reminderLabel.value).toBe('今天的三次训练已完成')
      expect(view.quests.value[0]?.highlight).toBe(false)
    }
  })

  it('does not invent a training goal for a questionnaire-only group', () => {
    const state = progressState(0)
    if (state.value.status !== 'ready') throw new Error('fixture must be ready')
    state.value.progress.modalities = []
    state.value.progress.dailyTarget = 0
    const view = useTrainingHomeProgressViewModel({ progressState: state })
    expect(view.reminderLabel.value).toBe('今日请完成久坐问卷')
    expect(view.quests.value).toEqual([])
  })
})
