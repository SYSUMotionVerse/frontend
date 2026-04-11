import type { CheckpointKey, StudentProfile } from '../../types/student'
import { resolveStartupEntryRoute } from '../../domain/student/access'
import { useStudentStore } from '../composables/useStudentStore'
import type { StudentAccessHydrationInput } from '../composables/useStudentStore'
import { createBackendClient } from './backendClient'
import {
  mapBackendScaleToQuestionnaire,
  buildPsychologyScaleSubmitPayload,
  mapPsychologyRecordSummary
} from './psychologyModels'
import {
  mapBackendAssessmentHistory,
  mapBackendPhysicalMetrics,
  mapBackendTrainingHistory
} from './growthBackendModels'
import type {
  BackendCurrentUser,
  BackendExerciseType,
  BackendSyncResult,
  LongQuestionnaireSyncResult,
  LongQuestionnaireSyncInput,
  RegistrationSyncInput,
  StairSessionSyncInput,
  StairsRecordCreatePayload,
  StudentBackendSyncDependencies,
  SurveyRecordCreatePayload,
  UserUpdatePayload,
  VisualSessionSyncInput
} from './studentBackendTypes'

type StartupTargetPage = 'register' | 'baselineQuestionnaire' | 'home'

type StartupTargetPageUrl =
  | '/pages/access/register'
  | '/pages/access/questionnaire?checkpoint=baseline'
  | '/pages/training/home'

type StudentBackendAccessDependencies = StudentBackendSyncDependencies & {
  getCurrentUser: () => Promise<BackendCurrentUser>
}

type StudentBackendBootstrapAccessOptions = {
  resolveLocalProfile: () => StudentProfile
  hydrateAccessState: (input: StudentAccessHydrationInput) => void
}

export type BootstrapAccessResult = {
  targetPage: StartupTargetPage
  targetPageUrl: StartupTargetPageUrl
}

function toJsonString(value: Record<string, unknown>) {
  return JSON.stringify(value)
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T
}

function resolveGenderValue(gender: StudentProfile['gender']) {
  if (gender === '男') {
    return 1 as const
  }

  if (gender === '女') {
    return 2 as const
  }

  return undefined
}

export function mapStudentProfileToUserUpdatePayload(profile: RegistrationSyncInput): UserUpdatePayload {
  return omitUndefined({
    name: profile.name.trim() || undefined,
    gender: resolveGenderValue(profile.gender),
    student_id: profile.studentId.trim() || undefined,
    major: profile.major.trim() || undefined,
    height: profile.heightCm > 0 ? profile.heightCm : undefined,
    weight: profile.weightKg > 0 ? profile.weightKg : undefined
  })
}

export function buildRegistrationSurveyRecordPayload(profile: RegistrationSyncInput): SurveyRecordCreatePayload {
  return {
    survey_type: 1,
    analysis: toJsonString({
      source: 'registration',
      age: profile.age,
      grade: profile.grade,
      restingHeartRate: profile.restingHeartRate,
      avatarUrl: profile.avatarUrl,
      avatarSource: profile.avatarSource
    })
  }
}

export function buildLongQuestionnaireSurveyRecordPayload(
  input: {
    checkpoint: CheckpointKey
    responses: Record<string, number>
    score: number
    percentage: number
    submittedAt: string
  }
): SurveyRecordCreatePayload {
  return {
    survey_type: 2,
    score: input.score,
    analysis: toJsonString({
      source: 'long-questionnaire',
      checkpoint: input.checkpoint,
      percentage: input.percentage,
      submittedAt: input.submittedAt,
      responses: input.responses
    })
  }
}

export function resolveBackendExerciseType(
  modality: VisualSessionSyncInput['modality']
): BackendExerciseType {
  return modality === 'hiit' ? 'HIIT' : 'MARTIAL_ARTS'
}

export function buildStairsRecordPayload(input: StairSessionSyncInput): StairsRecordCreatePayload {
  return {
    duration: input.durationSeconds,
    speed_data: {
      completedIntervals: input.completedIntervals
    },
    acceleration_data: {
      qualityScore: input.qualityScore,
      summary: input.summary
    },
    steps_count: null,
    calories: null
  }
}

function resolveDefaultDependencies(): StudentBackendAccessDependencies {
  return createBackendClient()
}

function resolveDefaultBootstrapAccessOptions(): StudentBackendBootstrapAccessOptions {
  const store = useStudentStore()

  return {
    resolveLocalProfile: () => store.getSnapshot().profile,
    hydrateAccessState: input => {
      store.hydrateAccessState(input)
    }
  }
}

function hasQuestions(
  value: Awaited<ReturnType<StudentBackendSyncDependencies['getNextPsychologyScale']>>
): value is Extract<typeof value, { questions: unknown[] }> {
  return Array.isArray((value as { questions?: unknown[] }).questions)
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toPositiveNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

function resolveBackendGenderLabel(gender: BackendCurrentUser['gender']): StudentProfile['gender'] {
  if (gender === 1) {
    return '男'
  }

  if (gender === 2) {
    return '女'
  }

  return ''
}

export function isBackendProfileComplete(user: BackendCurrentUser) {
  return (
    hasTextValue(user.name) &&
    user.gender !== null &&
    hasTextValue(user.student_id) &&
    hasTextValue(user.major) &&
    toPositiveNumber(user.height) !== null &&
    toPositiveNumber(user.weight) !== null
  )
}

export function mapBackendCurrentUserToStudentProfile(
  user: BackendCurrentUser,
  seedProfile: StudentProfile
): StudentProfile {
  const heightCm = toPositiveNumber(user.height)
  const weightKg = toPositiveNumber(user.weight)

  return {
    ...seedProfile,
    studentId: hasTextValue(user.student_id) ? user.student_id.trim() : '',
    name: hasTextValue(user.name) ? user.name.trim() : '',
    gender: resolveBackendGenderLabel(user.gender),
    major: hasTextValue(user.major) ? user.major.trim() : '',
    heightCm: heightCm ?? 0,
    weightKg: weightKg ?? 0,
    completed: isBackendProfileComplete(user)
  }
}

function buildBootstrapAccessResult(targetEntryRoute: string): BootstrapAccessResult {
  if (targetEntryRoute === '/register') {
    return {
      targetPage: 'register',
      targetPageUrl: '/pages/access/register'
    }
  }

  if (targetEntryRoute === '/questionnaires/baseline') {
    return {
      targetPage: 'baselineQuestionnaire',
      targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline'
    }
  }

  return {
    targetPage: 'home',
    targetPageUrl: '/pages/training/home'
  }
}

async function runIfEnabled(
  isEnabled: boolean,
  action: () => Promise<void>
): Promise<BackendSyncResult> {
  if (!isEnabled) {
    return {
      synced: false,
      reason: 'disabled'
    }
  }

  await action()

  return {
    synced: true
  }
}

export function createStudentBackendSync(
  overrides: Partial<StudentBackendAccessDependencies> = {},
  bootstrapAccessOverrides: Partial<StudentBackendBootstrapAccessOptions> = {}
) {
  const dependencies = {
    ...resolveDefaultDependencies(),
    ...overrides
  } satisfies StudentBackendAccessDependencies

  return {
    isEnabled: dependencies.isEnabled,
    async bootstrapAccess() {
      if (!dependencies.isEnabled()) {
        return buildBootstrapAccessResult('/register')
      }

      await dependencies.ensureSession()

      const [backendUser, psychologyRecords] = await Promise.all([
        dependencies.getCurrentUser(),
        dependencies.listPsychologyRecords()
      ])

      const bootstrapAccess = {
        ...resolveDefaultBootstrapAccessOptions(),
        ...bootstrapAccessOverrides
      } satisfies StudentBackendBootstrapAccessOptions

      const profile = mapBackendCurrentUserToStudentProfile(
        backendUser,
        bootstrapAccess.resolveLocalProfile()
      )
      const hasCompletedBaselineQuestionnaire = psychologyRecords.length > 0

      bootstrapAccess.hydrateAccessState({
        profile,
        hasCompletedBaselineQuestionnaire
      })

      const targetEntryRoute = resolveStartupEntryRoute({
        isProfileComplete: profile.completed,
        hasCompletedBaselineQuestionnaire
      })

      return buildBootstrapAccessResult(targetEntryRoute)
    },
    async loadLongQuestionnaire(preferredCheckpoint?: CheckpointKey) {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()

      const nextScale = await dependencies.getNextPsychologyScale()
      if (hasQuestions(nextScale) && nextScale.questions.length > 0) {
        return mapBackendScaleToQuestionnaire(nextScale)
      }

      const scales = await dependencies.listPsychologyScales()
      const preferredScale = preferredCheckpoint
        ? scales.find(scale => mapBackendScaleToQuestionnaire(scale).checkpoint === preferredCheckpoint)
        : undefined
      const fallbackScale = preferredScale ?? scales.find(scale => scale.questions.length > 0)

      return fallbackScale ? mapBackendScaleToQuestionnaire(fallbackScale) : null
    },
    async syncRegistration(profile: RegistrationSyncInput) {
      return runIfEnabled(dependencies.isEnabled(), async () => {
        await dependencies.ensureSession()
        await dependencies.updateProfile(mapStudentProfileToUserUpdatePayload(profile))
        try {
          await dependencies.createSurveyRecord(buildRegistrationSurveyRecordPayload(profile))
        } catch {
          // Registration metadata fallback should not block the primary profile update flow.
        }
      })
    },
    async syncLongQuestionnaire(input: LongQuestionnaireSyncInput) {
      if (!dependencies.isEnabled()) {
        return {
          synced: false,
          reason: 'disabled'
        } satisfies LongQuestionnaireSyncResult
      }

      await dependencies.ensureSession()
      const response = await dependencies.submitPsychologyScale(
        buildPsychologyScaleSubmitPayload(input.scaleId, input.answers)
      )
      const summary = mapPsychologyRecordSummary(response.record)

      return {
        synced: true,
        score: summary.score,
        percentage: summary.percentage,
        analysis: summary.analysis,
        submittedAt: summary.submittedAt
      } satisfies LongQuestionnaireSyncResult
    },
    async syncVisualSession(input: VisualSessionSyncInput) {
      return runIfEnabled(dependencies.isEnabled(), async () => {
        await dependencies.ensureSession()

        const exerciseType = resolveBackendExerciseType(input.modality)
        const videos = await dependencies.listExerciseVideos(exerciseType)
        const video = videos[0]

        if (!video) {
          throw new Error(`No backend exercise video is configured for ${exerciseType}.`)
        }

        await dependencies.createExerciseRecord({
          video: video.id,
          duration: input.durationSeconds
        })
      })
    },
    async syncStairSession(input: StairSessionSyncInput) {
      return runIfEnabled(dependencies.isEnabled(), async () => {
        await dependencies.ensureSession()
        await dependencies.createStairsRecord(buildStairsRecordPayload(input))
      })
    },
    async loadGrowthHistory() {
      if (!dependencies.isEnabled()) {
        return {
          assessments: [],
          trainingSessions: []
        }
      }

      await dependencies.ensureSession()
      const [exerciseRecords, stairRecords, psychologyRecords] = await Promise.all([
        dependencies.listExerciseRecords(),
        dependencies.listStairRecords(),
        dependencies.listPsychologyRecords()
      ])

      return {
        assessments: mapBackendAssessmentHistory(psychologyRecords),
        trainingSessions: mapBackendTrainingHistory(exerciseRecords, stairRecords)
      }
    },
    async loadPhysicalMetrics() {
      if (!dependencies.isEnabled()) {
        return []
      }

      await dependencies.ensureSession()
      const trend = await dependencies.getPhysicalTestTrend()
      return mapBackendPhysicalMetrics(trend)
    }
  }
}

export const studentBackendSync = createStudentBackendSync()
