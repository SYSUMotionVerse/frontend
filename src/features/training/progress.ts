import type { TrainingModality } from '../../types/student'

export interface TrainingProgressModalityView {
  id: TrainingModality
  label: string
  completed: boolean
  completionCount?: number
}

export interface TrainingProgressViewModel {
  date: string
  dailyCount: number
  dailyTarget?: number
  weeklyTargetDays?: number
  goalCompleted: boolean
  modalities: readonly TrainingProgressModalityView[]
  week: {
    startDate: string
    endDate: string
    qualifyingDayCount: number
    qualifyingDates?: readonly string[]
  }
}
