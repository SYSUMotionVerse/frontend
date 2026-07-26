import type { PhysicalMetricTrend, TrainingModality } from '../../domain/student/types'
import { buildGrowthAchievementsFromAwardCodes } from '../../domain/student/growth'
import { buildSessionBadgesFromHistory } from '../../domain/student/sessionBadges'
import { mapPsychologyRecordSummary } from './psychologyModels'
import type {
  BackendAchievementAwards,
  BackendExerciseRecord,
  BackendExerciseScoreTrendResponse,
  BackendPhysicalTrendResponse,
  BackendPsychologyRecord,
  BackendStairRecord,
  GrowthAssessmentHistoryItem,
  GrowthTrainingHistoryItem,
  GrowthVisualScoreTrendModel
} from './studentBackendTypes'

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function toNullableNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveExerciseModality(record: BackendExerciseRecord): TrainingModality {
  return record.video_info?.exercise_type === 'HIIT' ? 'hiit' : 'wushu'
}

function resolveBackendModality(
  modality: BackendAchievementAwards['session_badges'][number]['modality']
): TrainingModality {
  if (modality === 'HIIT') return 'hiit'
  if (modality === 'STAIRS') return 'stair'
  return 'wushu'
}

function formatDate(isoLike: string) {
  return isoLike.slice(0, 10)
}

export function mapBackendTrainingHistory(
  exerciseRecords: BackendExerciseRecord[],
  stairRecords: BackendStairRecord[]
): GrowthTrainingHistoryItem[] {
  const visualSessions = exerciseRecords
    .filter(record => record.status !== 'PENDING')
    .map(record => {
      const score = toNullableNumber(record.score)
      return {
        createdAt: record.created_at,
        id: `visual-${record.id}`,
        modality: resolveExerciseModality(record),
        date: formatDate(record.created_at),
        summary: record.comment || record.video_info?.title || '已完成训练。',
        qualityScore: score === null ? null : Math.round(score),
        scoreDetails: record.scoreDetails ?? record.poseAnalysis?.scoreDetails ?? null
      }
    })

  const stairSessions = stairRecords.map(record => {
    const score = toNullableNumber(record.acceleration_data?.qualityScore)
    return {
      createdAt: record.created_at,
      id: `stair-${record.id}`,
      modality: 'stair' as const,
      date: formatDate(record.created_at),
      summary: typeof record.acceleration_data?.summary === 'string'
        ? record.acceleration_data.summary
        : '已完成楼梯训练。',
      qualityScore: score === null ? null : Math.round(score)
    }
  })

  return [...visualSessions, ...stairSessions]
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    .map(({ createdAt: _createdAt, ...session }) => session)
}

export function mapBackendVisualScoreTrend(
  response: BackendExerciseScoreTrendResponse
): GrowthVisualScoreTrendModel {
  return {
    trend: response.trend.map(point => ({
      recordId: point.recordId,
      date: point.date,
      overallScore: toNumber(point.overallScore)
    })),
    dimensions: response.dimensions.map(dimension => ({
      key: dimension.key,
      label: dimension.label,
      values: dimension.values.map(value => toNumber(value))
    })),
    summary: {
      sessionCount: response.summary.sessionCount,
      latestOverallScore: toNumber(response.summary.latestOverallScore),
      bestOverallScore: toNumber(response.summary.bestOverallScore)
    }
  }
}

export function mapBackendAssessmentHistory(
  records: BackendPsychologyRecord[]
): GrowthAssessmentHistoryItem[] {
  return records.map(record => {
    const summary = mapPsychologyRecordSummary(record)

    return {
      checkpoint: summary.checkpoint,
      title: summary.title,
      score: summary.score,
      percentage: summary.percentage,
      submittedAt: summary.submittedAt
    }
  })
}

export function mapBackendAchievementAwards(response: BackendAchievementAwards) {
  const earnedCodes = new Set(
    response.milestones
      .filter(milestone => milestone.earned)
      .map(milestone => milestone.code)
  )

  return {
    achievements: buildGrowthAchievementsFromAwardCodes(earnedCodes),
    sessionBadges: buildSessionBadgesFromHistory(
      response.session_badges.map(award => ({
        id: award.training_session_id,
        modality: resolveBackendModality(award.modality),
        date: award.local_date,
        qualityScore: award.score
      }))
    )
  }
}

export function mapBackendPhysicalMetrics(
  response: BackendPhysicalTrendResponse
): PhysicalMetricTrend[] {
  const fieldDefinitions = [
    { label: 'BMI', unit: '', field: 'bmi' },
    { label: '肺活量', unit: 'ml', field: 'vital_capacity' },
    { label: '50 米跑', unit: 's', field: 'fifty_meter_run' },
    { label: '立定跳远', unit: 'cm', field: 'standing_long_jump' },
    { label: '坐位体前屈', unit: 'cm', field: 'sit_and_reach' },
    { label: '1 分钟仰卧起坐', unit: '次', field: 'one_minute_sit_ups' },
    { label: '800 米跑', unit: 's', field: 'eight_hundred_meter_run' },
    { label: '握力', unit: 'kg', field: 'grip_strength' }
  ] as const

  return fieldDefinitions.reduce<PhysicalMetricTrend[]>((metrics, definition) => {
    const values = response.trend
      .map(entry => entry[definition.field])
      .filter((value): value is number => typeof value === 'number')

    if (values.length === 0) {
      return metrics
    }

    metrics.push({
      label: definition.label,
      unit: definition.unit,
      values
    })

    return metrics
  }, [])
}
