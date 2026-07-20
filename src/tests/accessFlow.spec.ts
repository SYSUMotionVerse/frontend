import { completeStudentProfile, createInitialStudentState } from '../domain/student/state'
import type { StudentAppState } from '../types/student'

describe('student access flow', () => {
  async function loadResolver() {
    return import('../domain/student/access')
  }

  function withState(mutator: (state: StudentAppState) => void) {
    const state = createInitialStudentState()
    mutator(state)
    return state
  }

  it('routes first-time students to registration', async () => {
    const { resolveEntryRoute } = await loadResolver()

    expect(resolveEntryRoute(createInitialStudentState())).toBe('/register')
  })

  it('routes newly registered students to the baseline questionnaire', async () => {
    const { resolveEntryRoute } = await loadResolver()
    const state = withState((draft) => {
      draft.profile.completed = true
      draft.profile.name = 'Lin'
      draft.profile.studentId = 'S-001'
    })

    expect(resolveEntryRoute(state)).toBe('/questionnaires/baseline')
  })

  it('routes checkpoint users to the active incomplete questionnaire', async () => {
    const { resolveEntryRoute } = await loadResolver()
    const state = withState((draft) => {
      draft.profile.completed = true
      draft.longQuestionnaires.baseline.completed = true
      draft.activeCheckpoint = 'week8'
    })

    expect(resolveEntryRoute(state)).toBe('/questionnaires/week8')
  })

  it('routes fully eligible students to the home hub', async () => {
    const { resolveEntryRoute } = await loadResolver()
    const state = withState((draft) => {
      draft.profile.completed = true
      draft.longQuestionnaires.baseline.completed = true
      draft.activeCheckpoint = 'week4'
      draft.longQuestionnaires.week4.completed = true
    })

    expect(resolveEntryRoute(state)).toBe('/home')
  })

  it('resolves entry gating from a portable state snapshot without vue-router', async () => {
    const { resolveNextPageFromSnapshot } = await import('../uni-app/composables/useNavigationGuard')
    const state = withState((draft) => {
      draft.profile.completed = true
      draft.longQuestionnaires.baseline.completed = true
      draft.activeCheckpoint = 'week4'
    })

    expect(resolveNextPageFromSnapshot(state)).toBe('/questionnaires/week4')
  })

  it('routes to registration from startup when backend profile is incomplete', async () => {
    const { resolveStartupEntryRoute } = await loadResolver()

    expect(
      resolveStartupEntryRoute({
        isProfileComplete: false,
        hasCompletedBaselineQuestionnaire: false
      })
    ).toBe('/register')
  })

  it('routes to baseline questionnaire from startup when profile is complete but baseline is missing', async () => {
    const { resolveStartupEntryRoute } = await loadResolver()

    expect(
      resolveStartupEntryRoute({
        isProfileComplete: true,
        hasCompletedBaselineQuestionnaire: false
      })
    ).toBe('/questionnaires/baseline')
  })

  it('routes to home from startup when profile and baseline are both completed', async () => {
    const { resolveStartupEntryRoute } = await loadResolver()

    expect(
      resolveStartupEntryRoute({
        isProfileComplete: true,
        hasCompletedBaselineQuestionnaire: true
      })
    ).toBe('/home')
  })
})
