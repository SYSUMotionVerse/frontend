import { computed, type ComputedRef, type Ref } from 'vue'
import type { TrainingProgressState } from './useTrainingProgress'

interface TrainingHomeProgressViewModelOptions {
  progressState: Readonly<Ref<TrainingProgressState>>
  displayName: ComputedRef<string>
}

export function useTrainingHomeProgressViewModel(
  options: TrainingHomeProgressViewModelOptions
) {
  const progress = computed(() =>
    options.progressState.value.status === 'ready'
      ? options.progressState.value.progress
      : null
  )

  const reminderLabel = computed(() => {
    if (options.progressState.value.status === 'error') {
      return '今日训练进度同步失败'
    }
    if (!progress.value) {
      return '今日训练进度同步中'
    }
    return progress.value.goalCompleted
      ? '今天的三项训练已完成'
      : `今日已完成 ${progress.value.dailyCount}/3`
  })

  const quests = computed(() => {
    const dailyCount = progress.value?.dailyCount ?? 0
    const qualifyingDays = progress.value?.week.qualifyingDayCount ?? 0
    return [
      {
        id: 'daily-first',
        title: '完成 1 次有效打卡',
        detail: dailyCount > 0 ? `今天已经完成 ${dailyCount} 次有效打卡。` : '先完成一次短训练，把今天的状态点亮。',
        completed: dailyCount >= 1,
        highlight: false
      },
      {
        id: 'daily-three',
        title: '今日累计 3 次有效打卡',
        detail: `当前进度 ${dailyCount}/3，完成后就能保持今日满格节奏。`,
        completed: dailyCount >= 3,
        highlight: dailyCount < 3
      },
      {
        id: 'weekly-streak',
        title: '本周达标 3 天',
        detail: `目前已达标 ${qualifyingDays} 天，再稳住节奏就能拿下本周目标。`,
        completed: qualifyingDays >= 3,
        highlight: dailyCount >= 3 && qualifyingDays < 3
      }
    ]
  })

  const completedQuestCount = computed(() =>
    quests.value.filter(quest => quest.completed).length
  )

  const coachCards = computed(() => [
    {
      id: 'quote',
      eyebrow: '教练金句',
      title: '今天先把动作做扎实',
      body: `“${options.displayName.value}，真正的进步不是一次爆发，而是把每一次基本动作都做对。”`,
      footer: 'Coach Harris',
      tone: 'quote' as const
    },
    {
      id: 'recovery',
      eyebrow: '恢复建议',
      title: '补水和放松别落下',
      body: !progress.value?.goalCompleted
        ? '训练后先喝水，再做两分钟放松拉伸，下一轮会更轻松。'
        : '今天的目标已经完成，记得补水并让身体慢慢降下来。',
      footer: '恢复优先，明天会更稳。',
      tone: 'tip' as const
    }
  ])

  return {
    progress,
    reminderLabel,
    quests,
    completedQuestCount,
    coachCards
  }
}
