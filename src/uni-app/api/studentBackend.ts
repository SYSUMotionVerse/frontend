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
import { DEFAULT_POSE_ANGLE_CONFIDENCE_THRESHOLD, type PoseAngleFrame } from '../components/pose/poseAnalysis'
import type {
  AvatarUploadResult,
  BackendCurrentUser,
  BackendExerciseRecord,
  BackendExerciseType,
  BackendSyncResult,
  LongQuestionnaireSyncResult,
  LongQuestionnaireSyncInput,
  ProfileAvatarSyncResult,
  RegistrationSyncInput,
  StairSessionSummary,
  StairSessionSyncInput,
  StairsRecordCreatePayload,
  StudentBackendSyncDependencies,
  SurveyRecordCreatePayload,
  UserUpdatePayload,
  VisualSessionSyncResult,
  VisualSessionSyncInput,
  VisualPoseAnalysisPayload
} from './studentBackendTypes'
import type { ReminderReturnTarget } from '../platform/reminders'
import {
  createPendingTrainingSubmissionStore,
  type PendingTrainingSubmission,
  type PendingTrainingSubmissionStore
} from '../platform/pendingTrainingSubmissions'

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

type StudentBackendSubmissionOptions = {
  pendingSubmissions: PendingTrainingSubmissionStore
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

const visualPoseAngleNames = [
  'left_elbow',
  'right_elbow',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'torso_rotation'
] as const satisfies VisualPoseAnalysisPayload['angle_names']

const poseAngleValueResolvers = [
  (frame: PoseAngleFrame) => frame.angles.leftElbow ?? null,
  (frame: PoseAngleFrame) => frame.angles.rightElbow ?? null,
  (frame: PoseAngleFrame) => frame.angles.leftShoulder ?? null,
  (frame: PoseAngleFrame) => frame.angles.rightShoulder ?? null,
  (frame: PoseAngleFrame) => frame.angles.leftHip ?? null,
  (frame: PoseAngleFrame) => frame.angles.rightHip ?? null,
  (frame: PoseAngleFrame) => frame.angles.leftKnee ?? null,
  (frame: PoseAngleFrame) => frame.angles.rightKnee ?? null,
  (frame: PoseAngleFrame) => frame.bodyRotationRad ?? null
] as const

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

function toFiniteNumberOrUndefined(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeStairSessionSummary(summary: StairSessionSyncInput['summary']): StairSessionSummary {
  if (typeof summary === 'string') {
    return {
      summaryText: summary
    }
  }

  return summary
}

export function buildStairsRecordPayload(input: StairSessionSyncInput): StairsRecordCreatePayload {
  const summary = normalizeStairSessionSummary(input.summary)

  return {
    duration: input.durationSeconds,
    training_session_id: input.sessionId,
    speed_data: omitUndefined({
      completedIntervals: input.completedIntervals,
      activeClimbSeconds: toFiniteNumberOrUndefined(summary.activeClimbSeconds),
      cadenceSpmAvg: toFiniteNumberOrUndefined(summary.cadenceSpmAvg),
      cadenceSpmPeak: toFiniteNumberOrUndefined(summary.cadenceSpmPeak),
      cadenceStability: toFiniteNumberOrUndefined(summary.cadenceStability),
      estimatedVerticalSpeedMps: toFiniteNumberOrUndefined(summary.estimatedVerticalSpeedMps),
      estimatedFloorsPerMin: toFiniteNumberOrUndefined(summary.estimatedFloorsPerMin),
      pauseCount: toFiniteNumberOrUndefined(summary.pauseCount),
      confidence: toFiniteNumberOrUndefined(summary.confidence)
    }),
    acceleration_data: omitUndefined({
      qualityScore: input.qualityScore,
      summaryText: summary.summaryText,
      confidence: toFiniteNumberOrUndefined(summary.confidence),
      cadenceStability: toFiniteNumberOrUndefined(summary.cadenceStability),
      pauseCount: toFiniteNumberOrUndefined(summary.pauseCount)
    }),
    steps_count: toFiniteNumberOrUndefined(summary.estimatedStepCount) ?? null,
    calories: toFiniteNumberOrUndefined(summary.calories) ?? null
  }
}

export function buildVisualPoseAnalysisPayload(
  angleFrames: Array<PoseAngleFrame | null | undefined>,
  confidenceThreshold = DEFAULT_POSE_ANGLE_CONFIDENCE_THRESHOLD
): VisualPoseAnalysisPayload | undefined {
  const compactFrames = angleFrames.filter((frame): frame is PoseAngleFrame => frame != null)

  if (compactFrames.length === 0) {
    return undefined
  }

  const firstTsMs = compactFrames[0].tsMs
  const lastTsMs = compactFrames[compactFrames.length - 1].tsMs
  const elapsedMs = lastTsMs - firstTsMs
  const fps =
    compactFrames.length > 1 && elapsedMs > 0
      ? Math.max(1, Math.round(((compactFrames.length - 1) * 1000) / elapsedMs))
      : 10

  return {
    schema_version: '0.1',
    sequence_id: `student_${firstTsMs}`,
    source: 'student',
    fps,
    angle_unit: 'radian',
    angle_names: [...visualPoseAngleNames],
    frames: compactFrames.map((frame, index) => ({
      frame_index: index,
      time: Number(((frame.tsMs - firstTsMs) / 1000).toFixed(3)),
      values: poseAngleValueResolvers.map(resolveValue => resolveValue(frame))
    }))
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

function resolveDefaultSubmissionOptions(): StudentBackendSubmissionOptions {
  return {
    pendingSubmissions: createPendingTrainingSubmissionStore()
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

function shouldUploadAvatar(profile: RegistrationSyncInput) {
  return (
    profile.avatarSource !== '' &&
    profile.avatarUrl.trim().startsWith('wxfile://')
  )
}

function resolveVisualSessionSummary(
  fallback: {
    qualityScore: number
    summary: string
  },
  record: BackendExerciseRecord | undefined
) {
  if (!record) {
    return fallback
  }

  const backendScore = toPositiveNumber(record.score)
  const qualityScore = backendScore !== null ? Math.round(backendScore) : fallback.qualityScore
  const summary = hasTextValue(record.comment) ? record.comment.trim() : fallback.summary

  return {
    qualityScore,
    summary
  }
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
  const backendAvatarUrl = hasTextValue(user.avatar) ? user.avatar.trim() : ''
  const hasBackendAvatar = backendAvatarUrl.length > 0

  return {
    ...seedProfile,
    avatarUrl: hasBackendAvatar ? backendAvatarUrl : seedProfile.avatarUrl,
    avatarSource: hasBackendAvatar ? '' : seedProfile.avatarSource,
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
  bootstrapAccessOverrides: Partial<StudentBackendBootstrapAccessOptions> = {},
  submissionOverrides: Partial<StudentBackendSubmissionOptions> = {}
) {
  const dependencies = {
    ...resolveDefaultDependencies(),
    ...overrides
  } satisfies StudentBackendAccessDependencies
  const submissionOptions = {
    ...resolveDefaultSubmissionOptions(),
    ...submissionOverrides
  } satisfies StudentBackendSubmissionOptions

  async function submitPendingTrainingJob(
    submission: Extract<PendingTrainingSubmission, { kind: 'visual' }>
  ): Promise<BackendExerciseRecord>
  async function submitPendingTrainingJob(
    submission: PendingTrainingSubmission
  ): Promise<unknown>
  async function submitPendingTrainingJob(submission: PendingTrainingSubmission) {
    await dependencies.ensureSession()
    if (submission.kind === 'visual') {
      const exerciseType = resolveBackendExerciseType(submission.modality)
      const videos = await dependencies.listExerciseVideos(exerciseType)
      const video = videos[0]
      if (!video) {
        throw new Error(`No backend exercise video is configured for ${exerciseType}.`)
      }

      return dependencies.createExerciseRecord({
        video: video.id,
        duration: submission.durationSeconds,
        training_session_id: submission.sessionId,
        ...(submission.poseAnalysis ? { poseAnalysis: submission.poseAnalysis } : {})
      })
    }

    return dependencies.createStairsRecord(buildStairsRecordPayload({
      sessionId: submission.sessionId,
      durationSeconds: submission.durationSeconds,
      completedIntervals: submission.completedIntervals,
      qualityScore: submission.qualityScore,
      summary: submission.summary
    }))
  }

  return {
    isEnabled: dependencies.isEnabled,
    async uploadAvatar(
      filePath: string,
      source: Exclude<StudentProfile['avatarSource'], ''>
    ): Promise<AvatarUploadResult> {
      if (!dependencies.isEnabled()) {
        return {
          avatarUrl: filePath
        }
      }

      await dependencies.ensureSession()
      return dependencies.uploadAvatar(filePath, source)
    },
    async syncProfileAvatarChange(
      filePath: string,
      source: Exclude<StudentProfile['avatarSource'], ''>,
      seedProfile: StudentProfile
    ): Promise<ProfileAvatarSyncResult> {
      if (!dependencies.isEnabled()) {
        return {
          avatarUrl: filePath,
          profile: {
            ...seedProfile,
            avatarUrl: filePath,
            avatarSource: source
          }
        }
      }

      await dependencies.ensureSession()
      const uploadResult = await dependencies.uploadAvatar(filePath, source)
      const profile = {
        ...seedProfile,
        avatarUrl: uploadResult.avatarUrl,
        avatarSource: source
      }

      return {
        avatarUrl: uploadResult.avatarUrl,
        profile
      }
    },
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
        let syncedProfile = profile

        if (shouldUploadAvatar(profile)) {
          const uploadResult = await dependencies.uploadAvatar(profile.avatarUrl, profile.avatarSource)
          syncedProfile = {
            ...profile,
            avatarUrl: uploadResult.avatarUrl
          }
        }

        await dependencies.updateProfile(mapStudentProfileToUserUpdatePayload(syncedProfile))
        try {
          await dependencies.createSurveyRecord(buildRegistrationSurveyRecordPayload(syncedProfile))
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
    async syncVisualSession(input: VisualSessionSyncInput): Promise<VisualSessionSyncResult> {
      if (!dependencies.isEnabled()) {
        return {
          synced: false,
          reason: 'disabled'
        }
      }

      const submission: PendingTrainingSubmission = {
        kind: 'visual',
        sessionId: input.sessionId,
        modality: input.modality,
        durationSeconds: input.durationSeconds,
        ...(input.poseAnalysis ? { poseAnalysis: input.poseAnalysis } : {}),
        queuedAt: new Date().toISOString()
      }
      submissionOptions.pendingSubmissions.save(submission)
      const record = await submitPendingTrainingJob(submission)
      submissionOptions.pendingSubmissions.remove(input.sessionId)

      return {
        synced: true,
        record
      }
    },
    async syncStairSession(input: StairSessionSyncInput) {
      if (!dependencies.isEnabled()) {
        return { synced: false, reason: 'disabled' } as const
      }

      const submission: PendingTrainingSubmission = {
        kind: 'stairs',
        sessionId: input.sessionId,
        durationSeconds: input.durationSeconds,
        completedIntervals: input.completedIntervals,
        qualityScore: input.qualityScore,
        summary: input.summary,
        queuedAt: new Date().toISOString()
      }
      submissionOptions.pendingSubmissions.save(submission)
      await submitPendingTrainingJob(submission)
      submissionOptions.pendingSubmissions.remove(input.sessionId)
      return { synced: true } as const
    },
    async retryPendingTrainingSubmissions() {
      const submissions = submissionOptions.pendingSubmissions.list()
      if (!dependencies.isEnabled() || submissions.length === 0) {
        return { attempted: 0, succeeded: 0 }
      }

      await dependencies.ensureSession()
      let succeeded = 0
      for (const submission of submissions) {
        try {
          await submitPendingTrainingJob(submission)
          submissionOptions.pendingSubmissions.remove(submission.sessionId)
          succeeded += 1
        } catch {
          // Keep ambiguous or failed submissions durable for the next refresh.
        }
      }

      return {
        attempted: submissions.length,
        succeeded
      }
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
    async loadTrainingProgress() {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      return dependencies.getTrainingProgress()
    },
    async loadStationNotifications() {
      if (!dependencies.isEnabled()) {
        return { count: 0, notifications: [] }
      }

      await dependencies.ensureSession()
      const [notifications, unread] = await Promise.all([
        dependencies.listNotifications(),
        dependencies.getUnreadNotifications()
      ])
      return {
        count: unread.count,
        notifications: notifications.filter(item => item.notification_type === 'TRAINING_REMINDER')
      }
    },
    async markStationNotificationRead(id: number) {
      if (!dependencies.isEnabled()) {
        return { synced: false, reason: 'disabled' } as const
      }

      await dependencies.ensureSession()
      await dependencies.markNotificationRead(id)
      return { synced: true } as const
    },
    async resolveReminderReturn(target: ReminderReturnTarget) {
      if (!dependencies.isEnabled()) {
        return { synced: false, reason: 'disabled' } as const
      }

      await dependencies.ensureSession()
      return dependencies.resolveReminderReturn({
        tracking_id: target.trackingId,
        slot: target.slot,
        local_date: target.localDate
      })
    },
    async loadPhysicalMetrics() {
      if (!dependencies.isEnabled()) {
        return []
      }

      await dependencies.ensureSession()
      const trend = await dependencies.getPhysicalTestTrend()
      return mapBackendPhysicalMetrics(trend)
    },
    async loadAdherenceData() {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      const now = new Date()
      const [compliance, calendar, trend] = await Promise.all([
        dependencies.getMyCompliance(),
        dependencies.getComplianceCalendar(now.getFullYear(), now.getMonth() + 1),
        dependencies.getComplianceTrend(12)
      ])

      return {
        todayCount: compliance.today_count,
        todayCompleted: compliance.today_completed,
        totalTrainingDays: compliance.total_training_days,
        completedDays: compliance.completed_days,
        complianceRate: compliance.compliance_rate,
        calendar: calendar.days.map(day => ({
          date: day.date,
          completedSessions: day.training_count,
          status: day.is_completed
            ? 'met-goal' as const
            : day.training_count > 0
              ? 'partial' as const
              : 'none' as const
        })),
        trend: trend.trend.map(point => ({
          period: point.period,
          label: point.label,
          trainingDays: point.training_days,
          totalCount: point.total_count,
          completedDays: point.completed_days,
          completionRate: point.completion_rate
        }))
      }
    }
  }
}

export const studentBackendSync = createStudentBackendSync()
