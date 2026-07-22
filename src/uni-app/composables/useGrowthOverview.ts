import { computed, onMounted, shallowRef } from 'vue'
import { buildGrowthSummary, resolvePhysicalMetricsState } from '../../domain/student/growth'
import type { GrowthAssessmentSummary, GrowthSummaryCard } from '../../domain/student/growth'
import { CHECKPOINT_LABELS } from '../../features/access/questionnaire'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import { studentBackendSync } from '../api/studentBackend'
import type {
  GrowthAssessmentHistoryItem,
  GrowthPhysicalMetrics,
  GrowthTrainingHistoryItem,
  GrowthVisualScoreTrendModel,
  StudentAdherenceData
} from '../api/studentBackendTypes'
import { useStudentStore } from './useStudentStore'
import { createRequestCache } from './useRequestCache'

const backendAssessments = shallowRef<GrowthAssessmentHistoryItem[] | null>(null)
const backendSessions = shallowRef<GrowthTrainingHistoryItem[] | null>(null)
const backendAdherence = shallowRef<StudentAdherenceData | null>(null)
const backendPhysicalMetrics = shallowRef<GrowthPhysicalMetrics | null>(null)
const scoreTrend = shallowRef<GrowthVisualScoreTrendModel | null>(null)

const growthOverviewCache = createRequestCache({
  ttlMs: 5 * 60_000,
  async load() {
    const [history, adherence, physicalMetrics, visualScoreTrend] = await Promise.all([
      studentBackendSync.loadGrowthHistory().catch(error => {
        reportBackendSyncError('成长历史加载', error)
        return null
      }),
      studentBackendSync.loadAdherenceData().catch(error => {
        reportBackendSyncError('成长依从性加载', error)
        return null
      }),
      studentBackendSync.loadPhysicalMetrics().catch(error => {
        reportBackendSyncError('成长体测趋势加载', error)
        return null
      }),
      studentBackendSync.loadVisualScoreTrend().catch(error => {
        reportBackendSyncError('视觉训练得分趋势加载', error)
        return null
      })
    ])

    if (history) {
      backendAssessments.value = history.assessments
      backendSessions.value = history.trainingSessions
    }
    if (adherence) backendAdherence.value = adherence
    if (physicalMetrics) backendPhysicalMetrics.value = physicalMetrics
    if (visualScoreTrend) scoreTrend.value = visualScoreTrend
  }
})

function resetBackendGrowthData() {
  backendAssessments.value = null
  backendSessions.value = null
  backendAdherence.value = null
  backendPhysicalMetrics.value = null
  scoreTrend.value = null
  growthOverviewCache.invalidate()
}

export function invalidateGrowthOverview() {
  growthOverviewCache.invalidate()
}

export function useGrowthOverview() {
  const store = useStudentStore()
  const summary = computed(() => buildGrowthSummary(store.getSnapshot()))

  const localAssessments = computed<GrowthAssessmentHistoryItem[]>(() =>
    Object.values(store.getSnapshot().longQuestionnaires)
      .filter(questionnaire => questionnaire.completed)
      .map(questionnaire => ({
        checkpoint: questionnaire.checkpoint,
        title: `${CHECKPOINT_LABELS[questionnaire.checkpoint]} 长问卷`,
        score: questionnaire.score ?? 0,
        percentage: questionnaire.percentage ?? 0,
        submittedAt: questionnaire.submittedAt
      }))
  )
  const localSessions = computed<GrowthTrainingHistoryItem[]>(() =>
    store.getSnapshot().sessions
      .filter(session => session.completed)
      .sort((left, right) => right.date.localeCompare(left.date))
      .map(session => ({
        id: session.id,
        modality: session.modality,
        date: session.date,
        summary: session.analysis.summary,
        qualityScore: session.analysis.qualityScore
      }))
  )
  const assessments = computed(() => backendAssessments.value ?? localAssessments.value)
  const sessions = computed(() => backendSessions.value ?? localSessions.value)
  const adherenceCalendar = computed(() =>
    backendAdherence.value?.calendar ?? summary.value.adherenceCalendar
  )
  const physicalMetricsState = computed(() => {
    if (backendPhysicalMetrics.value !== null) {
      return resolvePhysicalMetricsState({
        ...store.getSnapshot(),
        physicalMetrics: backendPhysicalMetrics.value
      })
    }

    return resolvePhysicalMetricsState(store.getSnapshot())
  })
  const latestAssessment = computed<GrowthAssessmentSummary | null>(() => {
    const latest = assessments.value
      .filter(assessment => assessment.submittedAt)
      .sort((left, right) => (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''))[0]

    return latest
      ? {
          checkpoint: latest.checkpoint,
          score: latest.score,
          percentage: latest.percentage,
          submittedAt: latest.submittedAt
        }
      : summary.value.latestAssessment
  })
  const summaryCards = computed<GrowthSummaryCard[]>(() => {
    const adherence = backendAdherence.value
    if (!adherence || backendSessions.value === null) {
      return summary.value.summaryCards
    }

    const latestWeek = adherence.trend.at(-1)
    return [
      {
        key: 'completed-sessions',
        label: '完成训练',
        value: String(backendSessions.value.length),
        description: '后端记录的已完成训练次数。'
      },
      {
        key: 'valid-checkins',
        label: '累计达标天',
        value: String(adherence.completedDays),
        description: `累计训练 ${adherence.totalTrainingDays} 天。`
      },
      {
        key: 'current-streak',
        label: '依从率',
        value: `${Math.round(adherence.complianceRate * 100)}%`,
        description: '基于后端达标记录计算。'
      },
      {
        key: 'weekly-goal',
        label: '最近一周达标',
        value: `${latestWeek?.completedDays ?? 0} 天`,
        description: latestWeek?.label ?? '暂无周趋势数据。'
      }
    ]
  })

  async function refresh(options: { force?: boolean } = {}) {
    if (!studentBackendSync.isEnabled()) {
      resetBackendGrowthData()
      return
    }
    await growthOverviewCache.get(options)
  }

  onMounted(() => {
    void refresh()
  })

  return {
    achievements: computed(() => summary.value.achievements),
    adherenceCalendar,
    assessments,
    latestAssessment,
    physicalMetricsState,
    scoreTrend,
    sessionBadges: computed(() => summary.value.sessionBadges),
    sessions,
    summaryCards,
    refresh,
    invalidate: invalidateGrowthOverview
  }
}
