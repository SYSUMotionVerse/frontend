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
  })

  it('returns an empty-state model when physical metrics are unavailable', async () => {
    const { resolvePhysicalMetricsState } = await loadGrowthModule()

    expect(resolvePhysicalMetricsState(createInitialStudentState())).toEqual({
      hasMetrics: false,
      message: 'Physical metrics will appear here after body-test data is imported.'
    })
  })
})
