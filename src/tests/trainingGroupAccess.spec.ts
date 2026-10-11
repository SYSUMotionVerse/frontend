import { describe, expect, it, vi } from 'vitest'
import { isTrainingAllowed } from '../features/training/groupAccess'
import { createInitialStudentState } from '../domain/student/state'
import type { BackendCurrentUser } from '../uni-app/api/studentBackendTypes'

const user: BackendCurrentUser = {
  id: 1, name: '参与者', gender: 1, student_id: '20260001', major: '体育',
  college: '体育部', education_level: 'undergraduate', height: 170, weight: 60,
  age: 20, grade: '2026级',
  study_group: { id: 4, name: '问卷组', code: 'questionnaire', allowed_modalities: [] }
}

describe('study group training access', () => {
  it('maps server group permissions independently of cached profile permissions', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')
    const seed = { ...createInitialStudentState().profile, allowedModalities: ['wushu', 'hiit', 'stair'] as const }
    const profile = mapBackendCurrentUserToStudentProfile(user, { ...seed, allowedModalities: [...seed.allowedModalities] })
    expect(profile.studyGroup).toMatchObject({ name: '问卷组' })
    expect(profile.allowedModalities).toEqual([])
    expect(profile.completed).toBe(true)
    for (const modality of ['wushu', 'hiit', 'stair'] as const) expect(isTrainingAllowed(profile, modality)).toBe(false)
    const resistance = mapBackendCurrentUserToStudentProfile({ ...user, study_group: {
      id: 2, name: '自重抗阻组', code: 'resistance', allowed_modalities: ['HIIT']
    } }, profile)
    expect(resistance.allowedModalities).toEqual(['hiit'])
    expect(isTrainingAllowed(resistance, 'hiit')).toBe(true)
    expect(isTrainingAllowed(resistance, 'stair')).toBe(false)
  })

  it('does not treat an unassigned WeChat identity as registered even with all profile fields', async () => {
    const { mapBackendCurrentUserToStudentProfile } = await import('../uni-app/api/studentBackend')
    const profile = mapBackendCurrentUserToStudentProfile({ ...user, study_group: null }, createInitialStudentState().profile)
    expect(profile.completed).toBe(false)
    expect(profile.allowedModalities).toEqual([])
  })

  it('sends the trimmed invitation to the registration API and does not retain it locally', async () => {
    const { createStudentBackendSync } = await import('../uni-app/api/studentBackend')
    const updateProfile = vi.fn().mockResolvedValue(user)
    const save = vi.fn()
    const sync = createStudentBackendSync({
      isEnabled: () => true, ensureSession: vi.fn(), updateProfile,
    }, {}, {
      registrationProfileStorage: { save, load: () => null, clear: vi.fn() },
    })
    const profile = { ...createInitialStudentState().profile, invitationCode: ' test-questionnaire ', completed: true }
    await sync.syncRegistration(profile)
    expect(updateProfile.mock.calls[0]?.[0]).toHaveProperty('invitation_code', 'test-questionnaire')
    expect(save.mock.calls[0]?.[0].invitationCode).toBeUndefined()
  })
})
