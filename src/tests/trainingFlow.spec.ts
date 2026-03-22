import { createInitialStudentState } from '../domain/student/state'
import type { StudentAppState } from '../types/student'

describe('student training and adherence flow', () => {
  async function loadTrainingModule() {
    return import('../domain/student/training')
  }

  it('counts a guided session as completed even with low quality', async () => {
    const { completeGuidedSession } = await loadTrainingModule()
    const state = createInitialStudentState()

    const nextState = completeGuidedSession(state, {
      modality: 'hiit',
      qualityScore: 34,
      summary: 'Keep your elbows higher next round.',
      capturedBy: 'camera'
    })

    expect(nextState.sessions).toHaveLength(1)
    expect(nextState.sessions[0]?.completed).toBe(true)
    expect(nextState.sessions[0]?.analysis.qualityScore).toBe(34)
  })

  it('caps valid daily check-ins at three', async () => {
    const { completeGuidedSession } = await loadTrainingModule()

    const state = Array.from({ length: 4 }).reduce<StudentAppState>((draft, _, index) => {
      return completeGuidedSession(draft, {
        modality: index === 3 ? 'stair' : 'wushu',
        qualityScore: 88,
        summary: 'Great pacing',
        capturedBy: index === 3 ? 'sensor' : 'camera'
      })
    }, createInitialStudentState())

    expect(state.dailyAdherence.validCheckIns).toBe(3)
    expect(state.dailyAdherence.rawSessions).toBe(4)
  })

  it('marks reminder eligibility when the daily target is incomplete', async () => {
    const { evaluateReminderEligibility } = await loadTrainingModule()
    const state = createInitialStudentState()
    state.dailyAdherence.validCheckIns = 2

    const nextState = evaluateReminderEligibility(state)

    expect(nextState.dailyAdherence.reminderEligible).toBe(true)
  })

  it('marks weekly adherence after three qualifying days', async () => {
    const { completeGuidedSession, startTrainingDay } = await loadTrainingModule()
    let state = createInitialStudentState()

    for (const date of ['2026-03-17', '2026-03-18', '2026-03-19']) {
      state = startTrainingDay(state, date)
      state = completeGuidedSession(state, {
        modality: 'wushu',
        qualityScore: 82,
        summary: 'Day one',
        capturedBy: 'camera'
      })
      state = completeGuidedSession(state, {
        modality: 'hiit',
        qualityScore: 79,
        summary: 'Day two',
        capturedBy: 'camera'
      })
      state = completeGuidedSession(state, {
        modality: 'stair',
        qualityScore: 73,
        summary: 'Day three',
        capturedBy: 'sensor'
      })
    }

    expect(state.weeklyAdherence.qualifyingDays).toBe(3)
    expect(state.weeklyAdherence.achieved).toBe(true)
  })

  it('updates training state through the uni-app store adapter', async () => {
    const { createStudentStore } = await import('../uni-app/composables/useStudentStore')
    const store = createStudentStore()

    store.completeProfile({
      ...store.getSnapshot().profile,
      completed: false,
      studentId: 'S-002',
      name: 'Wei'
    })
    store.submitLongQuestionnaire('baseline', 64, 80)
    store.completeTrainingSession({
      modality: 'stair',
      qualityScore: 91,
      summary: 'Strong finish',
      capturedBy: 'sensor'
    })
    store.refreshReminderEligibility()

    expect(store.getSnapshot().sessions).toHaveLength(1)
    expect(store.getSnapshot().dailyAdherence.rawSessions).toBe(1)
    expect(store.resolveNextPage()).toBe('/home')
  })

  it('creates state snapshots even when structuredClone is unavailable', async () => {
    const originalStructuredClone = globalThis.structuredClone
    const { createStudentStore } = await import('../uni-app/composables/useStudentStore')

    // @ts-expect-error test compatibility fallback
    delete globalThis.structuredClone

    try {
      const store = createStudentStore()

      store.completeProfile({
        ...store.getSnapshot().profile,
        completed: false,
        studentId: 'S-003',
        name: 'Mini Program User'
      })

      expect(store.getSnapshot().profile.studentId).toBe('S-003')
      expect(store.getSnapshot()).not.toBe(store.getSnapshot())
    } finally {
      globalThis.structuredClone = originalStructuredClone
    }
  })

  it('completes visual sessions from the camera adapter even with low analysis quality', async () => {
    const { completeGuidedSession } = await loadTrainingModule()
    const { createCameraSessionAnalysis } = await import('../uni-app/platform/camera')
    const state = createInitialStudentState()

    const analysis = createCameraSessionAnalysis({
      modality: 'hiit',
      qualityScore: 22
    })
    const nextState = completeGuidedSession(state, {
      modality: 'hiit',
      qualityScore: analysis.qualityScore,
      summary: analysis.summary,
      capturedBy: analysis.capturedBy
    })

    expect(nextState.sessions[0]?.completed).toBe(true)
    expect(nextState.sessions[0]?.analysis.capturedBy).toBe('camera')
    expect(nextState.sessions[0]?.analysis.qualityScore).toBe(22)
  })

  it('records stair sessions through the sensor adapter after the timer flow', async () => {
    const { completeGuidedSession } = await loadTrainingModule()
    const { createSensorSessionAnalysis } = await import('../uni-app/platform/sensors')
    const state = createInitialStudentState()

    const analysis = createSensorSessionAnalysis({
      durationSeconds: 30,
      completedIntervals: 1
    })
    const nextState = completeGuidedSession(state, {
      modality: 'stair',
      qualityScore: analysis.qualityScore,
      summary: analysis.summary,
      capturedBy: analysis.capturedBy
    })

    expect(nextState.sessions[0]?.completed).toBe(true)
    expect(nextState.sessions[0]?.analysis.capturedBy).toBe('sensor')
  })

  it('maps reminder-entry queries through the reminder adapter', async () => {
    const { resolveReminderSource } = await import('../uni-app/platform/reminders')

    expect(resolveReminderSource({ source: 'reminder' })).toBe('wechat-reminder')
    expect(resolveReminderSource({ source: 'manual' })).toBe(null)
  })
})
