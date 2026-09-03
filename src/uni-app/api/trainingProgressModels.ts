import type {
  TrainingProgressModalityView,
  TrainingProgressViewModel
} from '../../features/training/progress'
import type {
  BackendTrainingModality,
  BackendTrainingProgress
} from './studentBackendTypes'

const modalityView: Record<BackendTrainingModality, Pick<TrainingProgressModalityView, 'id' | 'label'>> = {
  MARTIAL_ARTS: { id: 'wushu', label: '传统体育养生跟练' },
  HIIT: { id: 'hiit', label: '自重抗阻跟练' },
  STAIRS: { id: 'stair', label: '楼梯训练' }
}

export function mapTrainingProgress(dto: BackendTrainingProgress): TrainingProgressViewModel {
  return {
    date: dto.date,
    dailyCount: dto.distinct_daily_count,
    goalCompleted: dto.daily_goal_completed,
    modalities: dto.modalities.map(item => ({
      ...modalityView[item.modality],
      completed: item.completed
    })),
    week: {
      startDate: dto.week.start_date,
      endDate: dto.week.end_date,
      qualifyingDayCount: dto.week.qualifying_day_count
    }
  }
}
