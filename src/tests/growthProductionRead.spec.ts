import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialStudentState } from '../domain/student/state'

const store = {
  getSnapshot: vi.fn(() => createInitialStudentState())
}

const studentBackendSync = {
  isEnabled: vi.fn(() => true),
  loadGrowthHistory: vi.fn(),
  loadAdherenceData: vi.fn(),
  loadPhysicalMetrics: vi.fn(),
  loadVisualScoreTrend: vi.fn()
}

vi.mock('../uni-app/composables/useStudentStore', () => ({
  useStudentStore: () => store
}))

vi.mock('../uni-app/api/studentBackend', async (importOriginal) => ({
  ...await importOriginal<typeof import('../uni-app/api/studentBackend')>(),
  studentBackendSync
}))

describe('production growth reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.getSnapshot.mockReturnValue(createInitialStudentState())
    studentBackendSync.isEnabled.mockReturnValue(true)
    studentBackendSync.loadGrowthHistory.mockResolvedValue({
      assessments: [
        {
          checkpoint: 'week4',
          title: '运动心理健康量表（第2次）',
          score: 8,
          percentage: 80,
          submittedAt: '2026-07-15T08:00:00Z'
        }
      ],
      trainingSessions: [
        {
          id: 'visual-17',
          modality: 'wushu',
          date: '2026-07-17',
          summary: '后端动作分析结果。',
          qualityScore: 91
        }
      ]
    })
    studentBackendSync.loadAdherenceData.mockResolvedValue({
      todayCount: 3,
      todayCompleted: true,
      totalTrainingDays: 6,
      completedDays: 4,
      complianceRate: 0.67,
      calendar: [
        { date: '2026-07-17', completedSessions: 3, status: 'met-goal' }
      ],
      trend: [
        {
          period: '2026-W29',
          label: '第29周',
          trainingDays: 4,
          totalCount: 9,
          completedDays: 3,
          completionRate: 0.75
        }
      ]
    })
    studentBackendSync.loadPhysicalMetrics.mockResolvedValue([
      { label: '肺活量', unit: 'ml', values: [2600, 2750] }
    ])
    studentBackendSync.loadVisualScoreTrend.mockResolvedValue({
      trend: [
        { recordId: 17, date: '2026-07-17', overallScore: 91 }
      ],
      dimensions: [
        { key: 'stability', label: '稳定性', values: [90] }
      ],
      summary: {
        sessionCount: 1,
        latestOverallScore: 91,
        bestOverallScore: 91
      }
    })
  })

  it('loads and renders real growth history, adherence, physical and score trend on the routed home page', async () => {
    const GrowthPage = (await import('../pages/growth/index.vue')).default
    const wrapper = mount(GrowthPage, {
      global: {
        stubs: {
          UniGrowthPageShell: { template: '<div><slot /></div>' }
        }
      }
    })

    await flushPromises()

    expect(studentBackendSync.loadGrowthHistory).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.loadAdherenceData).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.loadPhysicalMetrics).toHaveBeenCalledTimes(1)
    expect(studentBackendSync.loadVisualScoreTrend).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('最近一周达标3 天')
    expect(wrapper.text()).toContain('依从率67%')
    expect(wrapper.text()).toContain('后端动作分析结果。')
    expect(wrapper.text()).toContain('运动心理健康量表（第2次）')
    expect(wrapper.text()).toContain('2600')
    expect(wrapper.text()).toContain('91')
    expect(wrapper.findAll('.adherence-cell')).toHaveLength(1)
  })

  it('preserves local growth data when backend integration is disabled', async () => {
    const localState = createInitialStudentState()
    localState.sessions.push({
      id: 'local-session',
      modality: 'stair',
      date: '2026-07-18',
      completed: true,
      validCheckInApplied: true,
      restartedAfterInterrupt: false,
      shortQuestionnaire: null,
      analysis: {
        qualityScore: 83,
        summary: '本地楼梯训练记录。',
        capturedBy: 'sensor'
      }
    })
    localState.longQuestionnaires.baseline = {
      checkpoint: 'baseline',
      completed: true,
      score: 7,
      percentage: 70,
      submittedAt: '2026-07-01T08:00:00Z'
    }
    localState.physicalMetrics = [
      { label: '握力', unit: 'kg', values: [24.5] }
    ]
    store.getSnapshot.mockReturnValue(localState)
    studentBackendSync.isEnabled.mockReturnValue(false)

    const GrowthPage = (await import('../pages/growth/index.vue')).default
    const wrapper = mount(GrowthPage, {
      global: {
        stubs: {
          UniGrowthPageShell: { template: '<div><slot /></div>' }
        }
      }
    })

    await flushPromises()

    expect(studentBackendSync.loadGrowthHistory).not.toHaveBeenCalled()
    expect(studentBackendSync.loadAdherenceData).not.toHaveBeenCalled()
    expect(studentBackendSync.loadPhysicalMetrics).not.toHaveBeenCalled()
    expect(studentBackendSync.loadVisualScoreTrend).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('本地楼梯训练记录。')
    expect(wrapper.text()).toContain('基线 长问卷')
    expect(wrapper.text()).toContain('24.5')
  })

  it('loads visual score trend through the authenticated backend sync seam', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const ensureSession = vi.fn().mockResolvedValue(undefined)
    const getExerciseScoreTrend = vi.fn().mockResolvedValue({
      trend: [{ recordId: 17, date: '2026-07-17', overallScore: '91.5' }],
      dimensions: [{ key: 'stability', label: '稳定性', values: ['90'] }],
      summary: {
        sessionCount: 1,
        latestOverallScore: '91.5',
        bestOverallScore: '91.5'
      }
    })
    const sync = createStudentBackendSync({
      isEnabled: () => true,
      ensureSession,
      getExerciseScoreTrend
    })

    await expect(sync.loadVisualScoreTrend()).resolves.toEqual({
      trend: [{ recordId: 17, date: '2026-07-17', overallScore: 91.5 }],
      dimensions: [{ key: 'stability', label: '稳定性', values: [90] }],
      summary: {
        sessionCount: 1,
        latestOverallScore: 91.5,
        bestOverallScore: 91.5
      }
    })
    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(getExerciseScoreTrend).toHaveBeenCalledTimes(1)
  })
})
