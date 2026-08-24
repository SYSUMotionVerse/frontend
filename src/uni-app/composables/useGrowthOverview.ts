import { computed, onMounted, readonly, shallowRef } from 'vue'
import {
  buildGrowthAchievementsFromHistory,
  buildGrowthSummary,
  resolvePhysicalMetricsState
} from '../../domain/student/growth'
import type { GrowthAssessmentSummary, GrowthSummaryCard } from '../../domain/student/growth'
import { buildSessionBadgesFromHistory } from '../../domain/student/sessionBadges'
import { CHECKPOINT_LABELS } from '../../features/access/questionnaire'
import { reportBackendSyncError } from '../api/reportBackendSyncError'
import { mapBackendAchievementAwards } from '../api/growthBackendModels'
import { studentBackendSync } from '../api/studentBackend'
import type {
  BackendAchievementAwards,
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
const backendAwards = shallowRef<BackendAchievementAwards | null>(null)
const loadState = shallowRef<{
  status: 'loading' | 'ready' | 'partial' | 'error'
  message: string
}>({
  status: 'loading',
  message: '正在同步成长记录…'
})

const growthOverviewCache = createRequestCache({
  ttlMs: 5 * 60_000,
  async load() {
    const results = await Promise.allSettled([
      studentBackendSync.loadGrowthHistory(),
      studentBackendSync.loadAdherenceData(),
      studentBackendSync.loadPhysicalMetrics(),
      studentBackendSync.loadVisualScoreTrend(),
      studentBackendSync.loadAchievementAwards?.() ?? Promise.resolve(null)
    ])
    const [
      historyResult,
      adherenceResult,
      physicalMetricsResult,
      visualScoreTrendResult,
      awardsResult
    ] = results
    const failures: string[] = []

    if (historyResult.status === 'fulfilled') {
      backendAssessments.value = historyResult.value.assessments
      backendSessions.value = historyResult.value.trainingSessions
    } else {
      failures.push('训练与评估历史')
      reportBackendSyncError('成长历史加载', historyResult.reason)
    }
    if (adherenceResult.status === 'fulfilled') {
      backendAdherence.value = adherenceResult.value
    } else {
      failures.push('坚持记录')
      reportBackendSyncError('成长依从性加载', adherenceResult.reason)
    }
    if (physicalMetricsResult.status === 'fulfilled') {
      backendPhysicalMetrics.value = physicalMetricsResult.value
    } else {
      failures.push('体能指标')
      reportBackendSyncError('成长体测趋势加载', physicalMetricsResult.reason)
    }
    if (visualScoreTrendResult.status === 'fulfilled') {
      scoreTrend.value = visualScoreTrendResult.value
    } else {
      failures.push('动作得分趋势')
      reportBackendSyncError('视觉训练得分趋势加载', visualScoreTrendResult.reason)
    }
    if (awardsResult.status === 'fulfilled') {
      backendAwards.value = awardsResult.value
    } else {
      failures.push('成长徽章')
      reportBackendSyncError('成长徽章加载', awardsResult.reason)
    }

    loadState.value = failures.length === 0
      ? { status: 'ready', message: '' }
      : {
          status: failures.length === results.length ? 'error' : 'partial',
          message: `${failures.join('、')}暂时无法同步，可重新加载。`
        }
  }
})

function resetBackendGrowthData() {
  backendAssessments.value = null
  backendSessions.value = null
  backendAdherence.value = null
  backendPhysicalMetrics.value = null
  scoreTrend.value = null
  backendAwards.value = null
  loadState.value = { status: 'ready', message: '' }
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
  const mappedAwards = computed(() => (
    backendAwards.value === null
      ? null
      : mapBackendAchievementAwards(backendAwards.value)
  ))
  const achievements = computed(() => (
    mappedAwards.value !== null
      ? mappedAwards.value.achievements
      : backendSessions.value !== null && backendAssessments.value !== null
      ? buildGrowthAchievementsFromHistory(backendSessions.value, backendAssessments.value.length)
      : summary.value.achievements
  ))
  const sessionBadges = computed(() => (
    mappedAwards.value !== null
      ? mappedAwards.value.sessionBadges
      : backendSessions.value !== null
      ? buildSessionBadgesFromHistory(backendSessions.value)
      : summary.value.sessionBadges
  ))
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
        description: `累计有训练 ${adherence.totalTrainingDays} 天。`
      },
      {
        key: 'current-streak',
        label: '达标日/有训练日',
        value: `${Math.round(adherence.complianceRate * 100)}%`,
        description: '以有训练的日为分母计算。'
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
    if (options.force || loadState.value.status === 'loading') {
      loadState.value = {
        status: 'loading',
        message: '正在同步成长记录…'
      }
    }
    await growthOverviewCache.get(options)
  }

  onMounted(() => {
    void refresh()
  })

  return {
    achievements,
    adherenceData: computed(() => backendAdherence.value),
    adherenceCalendar,
    assessments,
    latestAssessment,
    loadState: readonly(loadState),
    physicalMetricsState,
    scoreTrend,
    sessionBadges,
    sessions,
    summaryCards,
    refresh,
    invalidate: invalidateGrowthOverview
  }
}
