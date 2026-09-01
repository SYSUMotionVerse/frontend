import { computed, type ComputedRef, type Ref } from 'vue'
import type { TrainingProgressState } from './useTrainingProgress'
import { TRAINING_HOME_QUOTES } from '../../features/training/trainingHomeQuotes'

interface TrainingHomeProgressViewModelOptions {
  progressState: Readonly<Ref<TrainingProgressState>>
  displayName?: ComputedRef<string>
  coachQuote?: Readonly<Ref<string>>
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
    const modalities = progress.value?.modalities ?? []
    const firstPendingId = modalities.find(item => !item.completed)?.id

    return modalities.map(item => ({
      id: item.id,
      title: item.label,
      detail: item.completed
        ? '今天已完成，可以按自己的节奏继续练习。'
        : '完成一轮训练，点亮今天的进度。',
      completed: item.completed,
      highlight: item.id === firstPendingId
    }))
  })

  const weeklyQualifyingDayCount = computed(() =>
    progress.value?.week.qualifyingDayCount ?? 0
  )

  const completedQuestCount = computed(() =>
    quests.value.filter(quest => quest.completed).length
  )

  const coachCards = computed(() => [
    {
      id: 'quote',
      eyebrow: '教练金句',
      title: options.coachQuote?.value ?? TRAINING_HOME_QUOTES[0],
      body: '',
      footer: '屈萍老师',
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
    weeklyQualifyingDayCount,
    coachCards
  }
}
