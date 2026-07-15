import type { TrainingModality } from '../../types/student'

export interface TrainingProgressModalityView {
  id: TrainingModality
  label: string
  completed: boolean
}

export interface TrainingProgressViewModel {
  date: string
  dailyCount: number
  goalCompleted: boolean
  modalities: readonly TrainingProgressModalityView[]
  week: {
    startDate: string
    endDate: string
    qualifyingDayCount: number
  }
}
