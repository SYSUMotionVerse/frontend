import type {
  CheckpointKey,
  DailyAdherenceState,
  LongQuestionnaireState,
  PhysicalMetricTrend,
  SessionRecord,
  WeeklyAdherenceState
} from './types'

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
  'Physical metrics will appear here after body-test data is imported.'

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
        label: 'Completed Sessions',
        value: String(completedCount),
        description: 'Training sessions finished end-to-end.'
      },
      {
        key: 'valid-checkins',
        label: 'Valid Check-ins',
        value: String(validCheckInCount),
        description: 'Sessions counted toward adherence goals.'
      },
      {
        key: 'current-streak',
        label: 'Current Streak',
        value: `${streak} day${streak === 1 ? '' : 's'}`,
        description: 'Consecutive days with completed sessions.'
      },
      {
        key: 'weekly-goal',
        label: 'Weekly Goal',
        value: state.weeklyAdherence.achieved ? 'Achieved' : 'In Progress',
        description: `${state.weeklyAdherence.qualifyingDays} qualifying day${state.weeklyAdherence.qualifyingDays === 1 ? '' : 's'} this week.`
      }
    ],
    adherenceCalendar: buildAdherenceCalendar(completedSessions),
    achievements: buildAchievements(completedCount, streak, latestAssessment)
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
  if (sessions.length === 0) {
    return 0
  }

  const completedDates = new Set(sessions.map(session => session.date))
  const sortedDates = Array.from(completedDates).sort((left, right) => right.localeCompare(left))

  let streak = 1
  let cursor = new Date(`${sortedDates[0]}T00:00:00`)

  for (let index = 1; index < sortedDates.length; index += 1) {
    cursor.setDate(cursor.getDate() - 1)
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
      title: 'Started Strong',
      description: 'Complete your first training session.',
      earned: completedSessions >= 1
    },
    {
      id: 'momentum',
      title: 'Momentum Builder',
      description: 'Maintain a 3-day training streak.',
      earned: currentStreak >= 3
    },
    {
      id: 'assessment',
      title: 'Assessment Explorer',
      description: 'Finish at least one long questionnaire checkpoint.',
      earned: latestAssessment !== null
    }
  ]
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
