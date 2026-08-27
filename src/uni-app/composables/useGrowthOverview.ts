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

const growthOverviewSections = [
  'history',
  'adherence',
  'physicalMetrics',
  'visualScoreTrend',
  'awards'
] as const

export type GrowthOverviewSection = typeof growthOverviewSections[number]

interface UseGrowthOverviewOptions {
  sections?: readonly GrowthOverviewSection[]
}

const backendAssessments = shallowRef<GrowthAssessmentHistoryItem[] | null>(null)
const backendSessions = shallowRef<GrowthTrainingHistoryItem[] | null>(null)
const backendAdherence = shallowRef<StudentAdherenceData | null>(null)
const backendPhysicalMetrics = shallowRef<GrowthPhysicalMetrics | null>(null)
const scoreTrend = shallowRef<GrowthVisualScoreTrendModel | null>(null)
const backendAwards = shallowRef<BackendAchievementAwards | null>(null)

const growthSectionMetadata: Record<GrowthOverviewSection, {
  label: string
  errorContext: string
}> = {
  history: { label: '训练与评估历史', errorContext: '成长历史加载' },
  adherence: { label: '坚持记录', errorContext: '成长依从性加载' },
  physicalMetrics: { label: '体能指标', errorContext: '成长体测趋势加载' },
  visualScoreTrend: { label: '动作得分趋势', errorContext: '视觉训练得分趋势加载' },
  awards: { label: '成长徽章', errorContext: '成长徽章加载' }
}

// Growth detail pages use different sources. Keeping one cache per source means
// opening a focused page no longer requests unrelated history and trends.
const growthSectionCaches: Record<GrowthOverviewSection, ReturnType<typeof createRequestCache<void>>> = {
  history: createRequestCache({
    ttlMs: 5 * 60_000,
    async load() {
      const history = await studentBackendSync.loadGrowthHistory()
      backendAssessments.value = history.assessments
      backendSessions.value = history.trainingSessions
    }
  }),
  adherence: createRequestCache({
    ttlMs: 5 * 60_000,
    async load() {
      backendAdherence.value = await studentBackendSync.loadAdherenceData()
    }
  }),
  physicalMetrics: createRequestCache({
    ttlMs: 5 * 60_000,
    async load() {
      backendPhysicalMetrics.value = await studentBackendSync.loadPhysicalMetrics()
    }
  }),
  visualScoreTrend: createRequestCache({
    ttlMs: 5 * 60_000,
    async load() {
      scoreTrend.value = await studentBackendSync.loadVisualScoreTrend()
    }
  }),
  awards: createRequestCache({
    ttlMs: 5 * 60_000,
    async load() {
      backendAwards.value = await studentBackendSync.loadAchievementAwards?.() ?? null
    }
  })
}

function resetBackendGrowthData() {
  backendAssessments.value = null
  backendSessions.value = null
  backendAdherence.value = null
  backendPhysicalMetrics.value = null
  scoreTrend.value = null
  backendAwards.value = null
  Object.values(growthSectionCaches).forEach(cache => cache.invalidate())
}

export function invalidateGrowthOverview() {
  Object.values(growthSectionCaches).forEach(cache => cache.invalidate())
}

function resolveRequestedSections(options: UseGrowthOverviewOptions) {
  if (!options.sections?.length) {
    return [...growthOverviewSections]
  }

  return [...new Set(options.sections)]
}

export function useGrowthOverview(options: UseGrowthOverviewOptions = {}) {
  const store = useStudentStore()
  const requestedSections = resolveRequestedSections(options)
  const loadState = shallowRef<{
    status: 'loading' | 'ready' | 'partial' | 'error'
    message: string
  }>({
    status: 'loading',
    message: '正在同步成长记录…'
  })
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

  async function refresh(refreshOptions: { force?: boolean } = {}) {
    if (!studentBackendSync.isEnabled()) {
      resetBackendGrowthData()
      loadState.value = { status: 'ready', message: '' }
      return
    }
    if (refreshOptions.force || loadState.value.status === 'loading') {
      loadState.value = {
        status: 'loading',
        message: '正在同步成长记录…'
      }
    }
    const results = await Promise.allSettled(
      requestedSections.map(section => growthSectionCaches[section].get(refreshOptions))
    )
    const failures: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') return

      const section = requestedSections[index]
      const metadata = growthSectionMetadata[section]
      failures.push(metadata.label)
      reportBackendSyncError(metadata.errorContext, result.reason)
    })

    loadState.value = failures.length === 0
      ? { status: 'ready', message: '' }
      : {
          status: failures.length === results.length ? 'error' : 'partial',
          message: `${failures.join('、')}暂时无法同步，可重新加载。`
        }
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
