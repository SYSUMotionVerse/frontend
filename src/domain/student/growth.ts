import type {
  CheckpointKey,
  DailyAdherenceState,
  LongQuestionnaireState,
  PhysicalMetricTrend,
  SessionRecord,
  WeeklyAdherenceState
} from './types'
import { buildSessionBadges, type SessionBadge } from './sessionBadges'

export interface GrowthSummaryCard {
  key: 'completed-sessions' | 'valid-checkins' | 'current-streak' | 'weekly-goal'
  label: string
  value: string
  description: string
}

export interface GrowthAssessmentSummary {
  checkpoint: CheckpointKey
  score: number
  percentage: number
  submittedAt: string | null
}

export interface GrowthCalendarDay {
  date: string
  status: 'met-goal' | 'partial' | 'none'
  completedSessions: number
}

export interface GrowthAchievement {
  id: string
  title: string
  description: string
  earned: boolean
}

export interface GrowthHistorySession {
  date: string
}

export interface GrowthSummaryModel {
  completedSessions: number
  totalSessions: number
  validCheckInSessions: number
  currentStreak: number
  latestSession: SessionRecord | null
  latestAssessment: GrowthAssessmentSummary | null
  summaryCards: GrowthSummaryCard[]
  adherenceCalendar: GrowthCalendarDay[]
  achievements: GrowthAchievement[]
  sessionBadges: SessionBadge[]
}

export type PhysicalMetricsState =
  | {
      hasMetrics: true
      metrics: readonly PhysicalMetricTrend[]
    }
  | {
      hasMetrics: false
      message: string
    }

const CHECKPOINT_ORDER: CheckpointKey[] = ['baseline', 'week4', 'week8', 'week12']

const PHYSICAL_METRICS_EMPTY_MESSAGE =
  '导入体测数据后将在此显示体能指标。'

export type GrowthStateSource = {
  sessions: readonly SessionRecord[]
  longQuestionnaires: Readonly<Record<CheckpointKey, LongQuestionnaireState>>
  weeklyAdherence: Readonly<WeeklyAdherenceState>
  physicalMetrics: readonly PhysicalMetricTrend[]
  dailyAdherence?: Readonly<DailyAdherenceState>
}

export function buildGrowthSummary(state: GrowthStateSource): GrowthSummaryModel {
  const completedSessions = state.sessions.filter(session => session.completed)
  const validCheckInSessions = completedSessions.filter(session => session.validCheckInApplied)
  const latestSession = getLatestSession(completedSessions)
  const latestAssessment = getLatestAssessment(state.longQuestionnaires)

  const streak = calculateCurrentStreak(completedSessions)
  const completedCount = completedSessions.length
  const validCheckInCount = validCheckInSessions.length

  return {
    completedSessions: completedCount,
    totalSessions: state.sessions.length,
    validCheckInSessions: validCheckInCount,
    currentStreak: streak,
    latestSession,
    latestAssessment,
    summaryCards: [
      {
        key: 'completed-sessions',
        label: '完成训练',
        value: String(completedCount),
        description: '已完整完成的训练次数。'
      },
      {
        key: 'valid-checkins',
        label: '有效打卡',
        value: String(validCheckInCount),
        description: '计入坚持目标的训练次数。'
      },
      {
        key: 'current-streak',
        label: '当前连续天数',
        value: `${streak} 天`,
        description: '连续完成训练的天数。'
      },
      {
        key: 'weekly-goal',
        label: '每周目标',
        value: state.weeklyAdherence.achieved ? '已达成' : '进行中',
        description: `本周已达标 ${state.weeklyAdherence.qualifyingDays} 天。`
      }
    ],
    adherenceCalendar: buildAdherenceCalendar(completedSessions),
    achievements: buildAchievements(completedCount, streak, latestAssessment),
    sessionBadges: buildSessionBadges(completedSessions)
  }
}

export function resolvePhysicalMetricsState(state: GrowthStateSource): PhysicalMetricsState {
  if (state.physicalMetrics.length === 0) {
    return {
      hasMetrics: false,
      message: PHYSICAL_METRICS_EMPTY_MESSAGE
    }
  }

  return {
    hasMetrics: true,
    metrics: state.physicalMetrics
  }
}

export function buildGrowthAchievementsFromHistory(
  sessions: readonly GrowthHistorySession[],
  assessmentCount: number
): GrowthAchievement[] {
  return buildAchievements(
    sessions.length,
    calculateCurrentStreakFromDates(sessions.map(session => session.date)),
    assessmentCount > 0
      ? {
          checkpoint: 'baseline',
          score: 0,
          percentage: 0,
          submittedAt: null
        }
      : null
  )
}

export function buildGrowthAchievementsFromAwardCodes(
  earnedCodes: ReadonlySet<string>
): GrowthAchievement[] {
  return [
    {
      id: 'starter',
      title: '起步有力',
      description: '完成第一次训练。',
      earned: earnedCodes.has('starter')
    },
    {
      id: 'momentum',
      title: '势头建立者',
      description: '保持连续 3 天训练。',
      earned: earnedCodes.has('momentum')
    },
    {
      id: 'assessment',
      title: '评估探索者',
      description: '至少完成一次长问卷评估。',
      earned: earnedCodes.has('assessment')
    }
  ]
}

function getLatestSession(sessions: readonly SessionRecord[]): SessionRecord | null {
  if (sessions.length === 0) {
    return null
  }

  return [...sessions].sort((left, right) => right.date.localeCompare(left.date))[0]
}

function getLatestAssessment(
  questionnaires: Readonly<Record<CheckpointKey, LongQuestionnaireState>>
): GrowthAssessmentSummary | null {
  const completed = CHECKPOINT_ORDER.map(checkpoint => questionnaires[checkpoint])
    .filter(questionnaire => questionnaire.completed)
    .map(questionnaire => ({
      checkpoint: questionnaire.checkpoint,
      score: questionnaire.score ?? 0,
      percentage: questionnaire.percentage ?? 0,
      submittedAt: questionnaire.submittedAt
    }))

  if (completed.length === 0) {
    return null
  }

  return completed.sort((left, right) => {
    const leftIndex = CHECKPOINT_ORDER.indexOf(left.checkpoint)
    const rightIndex = CHECKPOINT_ORDER.indexOf(right.checkpoint)
    return rightIndex - leftIndex
  })[0]
}

function calculateCurrentStreak(sessions: readonly SessionRecord[]): number {
  return calculateCurrentStreakFromDates(sessions.map(session => session.date))
}

function calculateCurrentStreakFromDates(dates: readonly string[]): number {
  if (dates.length === 0) {
    return 0
  }

  const completedDates = new Set(dates)
  const sortedDates = Array.from(completedDates).sort((left, right) => right.localeCompare(left))

  let streak = 1
  let cursor = new Date(`${sortedDates[0]}T00:00:00Z`)

  for (let index = 1; index < sortedDates.length; index += 1) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    const expectedDate = toIsoDate(cursor)

    if (sortedDates[index] !== expectedDate) {
      break
    }

    streak += 1
  }

  return streak
}

function buildAdherenceCalendar(sessions: readonly SessionRecord[]): GrowthCalendarDay[] {
  const sessionByDate = sessions.reduce<Record<string, number>>((accumulator, session) => {
    accumulator[session.date] = (accumulator[session.date] ?? 0) + 1
    return accumulator
  }, {})

  const today = new Date()
  const calendar: GrowthCalendarDay[] = []

  for (let offset = 27; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const isoDate = toIsoDate(date)
    const completedCount = sessionByDate[isoDate] ?? 0

    calendar.push({
      date: isoDate,
      completedSessions: completedCount,
      status: completedCount >= 3 ? 'met-goal' : completedCount >= 1 ? 'partial' : 'none'
    })
  }

  return calendar
}

function buildAchievements(
  completedSessions: number,
  currentStreak: number,
  latestAssessment: GrowthAssessmentSummary | null
): GrowthAchievement[] {
  return [
    {
      id: 'starter',
      title: '起步有力',
      description: '完成第一次训练。',
      earned: completedSessions >= 1
    },
    {
      id: 'momentum',
      title: '势头建立者',
      description: '保持连续 3 天训练。',
      earned: currentStreak >= 3
    },
    {
      id: 'assessment',
      title: '评估探索者',
      description: '至少完成一次长问卷评估。',
      earned: latestAssessment !== null
    }
  ]
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
