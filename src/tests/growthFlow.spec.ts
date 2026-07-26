import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInitialStudentState } from '../domain/student/state'

describe('student growth summaries', () => {
  async function loadGrowthModule() {
    return import('../domain/student/growth')
  }

  it('builds student-facing summary cards from training history', async () => {
    const { buildGrowthSummary } = await loadGrowthModule()
    const state = createInitialStudentState()
    state.sessions = [
      {
        id: 'session-1',
        modality: 'wushu',
        date: '2026-03-18',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 86,
          summary: 'Smooth cadence',
          capturedBy: 'camera'
        }
      }
    ]
    state.longQuestionnaires.baseline.completed = true
    state.longQuestionnaires.baseline.score = 72
    state.longQuestionnaires.baseline.percentage = 86

    const summary = buildGrowthSummary(state)

    expect(summary.completedSessions).toBe(1)
    expect(summary.latestAssessment?.checkpoint).toBe('baseline')
    expect(summary.summaryCards).toEqual([
      {
        key: 'completed-sessions',
        label: '完成训练',
        value: '1',
        description: '已完整完成的训练次数。'
      },
      {
        key: 'valid-checkins',
        label: '有效打卡',
        value: '1',
        description: '计入坚持目标的训练次数。'
      },
      {
        key: 'current-streak',
        label: '当前连续天数',
        value: '1 天',
        description: '连续完成训练的天数。'
      },
      {
        key: 'weekly-goal',
        label: '每周目标',
        value: '进行中',
        description: '本周已达标 0 天。'
      }
    ])
    expect(summary.achievements.map(item => item.title)).toEqual([
      '起步有力',
      '势头建立者',
      '评估探索者'
    ])
    expect(summary.sessionBadges).toEqual([
      {
        id: 'session-1-badge',
        level: 'gold',
        title: '动作稳定星',
        description: '本次质量考评 86 分，动作控制和完成度都很稳定。',
        scoreLabel: '86 分',
        sessionDate: '2026-03-18',
        modalityLabel: '武术训练',
        svgName: 'stable-star',
        shareTitle: '我在 Sport Snack 获得了「动作稳定星」',
        sharePath: '/pages/training/feedback?sessionId=session-1'
      }
    ])
  })

  it('keeps the latest earned training badges visible in growth summaries', async () => {
    const { buildGrowthSummary } = await loadGrowthModule()
    const state = createInitialStudentState()
    state.sessions = [
      {
        id: 'session-low',
        modality: 'stair',
        date: '2026-03-17',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 58,
          summary: 'Slow down',
          capturedBy: 'sensor'
        }
      },
      {
        id: 'session-top',
        modality: 'hiit',
        date: '2026-03-19',
        completed: true,
        validCheckInApplied: true,
        restartedAfterInterrupt: false,
        shortQuestionnaire: null,
        analysis: {
          qualityScore: 94,
          summary: 'Great control',
          capturedBy: 'camera'
        }
      }
    ]

    const summary = buildGrowthSummary(state)

    expect(summary.sessionBadges.map(badge => badge.id)).toEqual([
      'session-top-badge',
      'session-low-badge'
    ])
    expect(summary.sessionBadges[0]).toMatchObject({
      level: 'platinum',
      title: '满格表现章',
      scoreLabel: '94 分',
      modalityLabel: 'HIIT 训练',
      svgName: 'full-power',
      shareTitle: '我在 Sport Snack 获得了「满格表现章」',
      sharePath: '/pages/training/feedback?sessionId=session-top'
    })
  })

  it('does not award a score badge when the backend score is unavailable', async () => {
    const { buildSessionBadgesFromHistory } = await import('../domain/student/sessionBadges')

    expect(buildSessionBadgesFromHistory([
      {
        id: 'visual-unscored',
        modality: 'wushu',
        date: '2026-03-20',
        qualityScore: null
      }
    ])).toEqual([])
  })

  it('places shareable training badges directly after the adherence heatmap on the growth page', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/growth/index.vue'),
      'utf8'
    )

    expect(pageSource).toContain('SessionBadgeList')
    expect(pageSource).toContain(':badges="sessionBadges"')
    expect(pageSource.indexOf('<AdherenceHeatmap')).toBeLessThan(pageSource.indexOf('<SessionBadgeList'))
    expect(pageSource).toContain('onShareAppMessage')
    expect(pageSource).toContain('targetDataset?.sharePath')
  })

  it('returns an empty-state model when physical metrics are unavailable', async () => {
    const { resolvePhysicalMetricsState } = await loadGrowthModule()

    expect(resolvePhysicalMetricsState(createInitialStudentState())).toEqual({
      hasMetrics: false,
      message: '导入体测数据后将在此显示体能指标。'
    })
  })

  it('rebuilds achievements from durable backend history after a restart', async () => {
    const { buildGrowthAchievementsFromHistory } = await loadGrowthModule()

    const achievements = buildGrowthAchievementsFromHistory([
      { date: '2026-07-18' },
      { date: '2026-07-17' },
      { date: '2026-07-16' }
    ], 1)

    expect(achievements.every(achievement => achievement.earned)).toBe(true)
  })
})
