import { beforeEach, describe, expect, it, vi } from 'vitest'

const bootstrapAccess = vi.fn()
const reLaunch = vi.fn().mockResolvedValue(undefined)

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    bootstrapAccess
  }
}))

describe('questionnaire preview access', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('uni', { reLaunch })
    const { resetProtectedStudentAccessForTests } = await import(
      '../uni-app/composables/useNavigationGuard'
    )
    resetProtectedStudentAccessForTests()
  })

  it('allows browsing when a questionnaire is due without granting execution', async () => {
    bootstrapAccess.mockResolvedValue({
      targetPage: 'questionnaire',
      targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline',
      checkpoint: 'baseline'
    })
    const {
      ensureProtectedStudentAccess,
      useProtectedAccessState
    } = await import('../uni-app/composables/useNavigationGuard')

    await expect(ensureProtectedStudentAccess('browse')).resolves.toBe(true)
    expect(useProtectedAccessState().value.level).toBe('browse')
    expect(reLaunch).not.toHaveBeenCalled()
  })

  it('redirects browse-only students when they try to execute training', async () => {
    bootstrapAccess.mockResolvedValue({
      targetPage: 'questionnaire',
      targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline',
      checkpoint: 'baseline'
    })
    const { ensureProtectedStudentAccess } = await import(
      '../uni-app/composables/useNavigationGuard'
    )

    await expect(ensureProtectedStudentAccess('execute')).resolves.toBe(false)
    expect(reLaunch).toHaveBeenCalledWith({
      url: '/pages/access/questionnaire?checkpoint=baseline'
    })
  })

  it('grants both browsing and execution after questionnaires are complete', async () => {
    bootstrapAccess.mockResolvedValue({
      targetPage: 'home',
      targetPageUrl: '/pages/training/home'
    })
    const {
      ensureProtectedStudentAccess,
      useProtectedAccessState
    } = await import('../uni-app/composables/useNavigationGuard')

    await expect(ensureProtectedStudentAccess('execute')).resolves.toBe(true)
    expect(useProtectedAccessState().value.level).toBe('execute')
    expect(reLaunch).not.toHaveBeenCalled()
  })
})
