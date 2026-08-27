import type { CheckpointKey, StudentProfile } from '../../types/student'
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
  mapBackendTrainingHistory,
  mapBackendVisualScoreTrend
} from './growthBackendModels'
import { DEFAULT_POSE_ANGLE_CONFIDENCE_THRESHOLD, type PoseAngleFrame } from '../components/pose/poseAnalysis'
import type {
  BackendCurrentUser,
  BackendExerciseRecord,
  BackendExerciseType,
  BackendQuestionnairePlan,
  BackendPsychologyRecord,
  BackendSyncResult,
  ExerciseArrangementDetail,
  TutorialResponse,
  ExerciseVideoSummary,
  LongQuestionnaireSyncResult,
  LongQuestionnaireSyncInput,
  RegistrationSyncInput,
  ShortQuestionnaireSyncInput,
  ShortQuestionnaireCreatePayload,
  ShortQuestionnaireSyncResult,
  StairSessionSummary,
  StairSessionSyncInput,
  StairsRecordCreatePayload,
  TrainingCountdownTtsCue,
  TrainingCredentialResponse,
  TrainingTtsCue,
  StudentBackendSyncDependencies,
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
import {
  createPendingShortQuestionnaireStore,
  type PendingShortQuestionnaireSubmission,
  type PendingShortQuestionnaireStore
} from '../platform/pendingShortQuestionnaires'
import {
  createRegistrationProfileStorage,
  type RegistrationProfileStorage
} from '../platform/registrationProfileStorage'

type StartupTargetPage = 'register' | 'questionnaire' | 'home'

type StartupTargetPageUrl =
  | '/pages/access/register'
  | `/pages/access/questionnaire?checkpoint=${CheckpointKey}`
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
  pendingShortQuestionnaires: PendingShortQuestionnaireStore
  registrationProfileStorage: RegistrationProfileStorage
}

export type BootstrapAccessResult = {
  targetPage: StartupTargetPage
  targetPageUrl: StartupTargetPageUrl
  checkpoint?: CheckpointKey
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
    weight: profile.weightKg > 0 ? profile.weightKg : undefined,
    age: profile.age > 0 ? profile.age : undefined,
    grade: profile.grade.trim() || undefined,
    resting_heart_rate: profile.restingHeartRate > 0 ? profile.restingHeartRate : undefined
  })
}

export function resolveBackendExerciseType(
  modality: VisualSessionSyncInput['modality']
): BackendExerciseType {
  return modality === 'hiit' ? 'HIIT' : 'MARTIAL_ARTS'
}

function resolveExerciseVideoUrl(video: ExerciseVideoSummary): ExerciseVideoSummary {
  const resolveAbsoluteUrl = (value: string | null | undefined) => {
    const source = value?.trim()
    if (!source || /^https?:\/\//i.test(source) || !source.startsWith('/')) {
      return source ?? null
    }
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000/api'
    const origin = configuredBaseUrl.match(/^(https?:\/\/[^/]+)/i)?.[1]
    return origin ? `${origin}${source}` : source
  }

  return {
    ...video,
    video_file: resolveAbsoluteUrl(video.video_file),
    tutorial_video_url: resolveAbsoluteUrl(video.tutorial_video_url),
    standard_data_url: resolveAbsoluteUrl(video.standard_data_url)
  }
}

function resolveAbsoluteAssetUrl(value: string | null | undefined) {
  const source = value?.trim()
  if (!source || /^https?:\/\//i.test(source) || !source.startsWith('/')) {
    return source ?? null
  }
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000/api'
  const origin = configuredBaseUrl.match(/^(https?:\/\/[^/]+)/i)?.[1]
  return origin ? `${origin}${source}` : source
}

function resolveTrainingTtsCueUrl(value: string) {
  return resolveAbsoluteAssetUrl(value) ?? ''
}

function resolveExerciseArrangementUrls(
  arrangement: ExerciseArrangementDetail
): ExerciseArrangementDetail {
  return {
    ...arrangement,
    countdown_tts_cues: arrangement.countdown_tts_cues?.map((cue: TrainingCountdownTtsCue) => ({
      ...cue,
      audio_url: resolveTrainingTtsCueUrl(cue.audio_url)
    })),
    items: [...arrangement.items]
      .sort((left, right) => left.order - right.order)
      .map(item => ({
        ...item,
        standard_data_url: resolveAbsoluteAssetUrl(item.standard_data_url),
        training_tts_cues: item.training_tts_cues?.map((cue: TrainingTtsCue) => ({
          ...cue,
          audio_url: resolveTrainingTtsCueUrl(cue.audio_url)
        })),
        video: resolveExerciseVideoUrl(item.video)
      }))
  }
}

function resolveTutorialResponseUrls(response: TutorialResponse): TutorialResponse {
  return {
    ...response,
    tutorial_video_url: resolveAbsoluteAssetUrl(response.tutorial_video_url),
    standard_data_url: resolveAbsoluteAssetUrl(response.standard_data_url)
  }
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
    ...(input.completedAt ? { client_completed_at: input.completedAt } : {}),
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
    pendingSubmissions: createPendingTrainingSubmissionStore(),
    pendingShortQuestionnaires: createPendingShortQuestionnaireStore(),
    registrationProfileStorage: createRegistrationProfileStorage()
  }
}

function hasQuestions(
  value: Awaited<ReturnType<StudentBackendSyncDependencies['getNextPsychologyScale']>>
): value is Extract<typeof value, { questions: unknown[] }> {
  return Boolean(value) && Array.isArray((value as { questions?: unknown[] }).questions)
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

function resolveVisualSessionSummary(
  fallback: {
    qualityScore: number | null
    summary: string
  },
  record: BackendExerciseRecord | undefined
) {
  if (!record) {
    return fallback
  }

  const backendScore = record.score === null || record.score === undefined
    ? null
    : toPositiveNumber(record.score)
  const qualityScore = backendScore !== null ? Math.round(backendScore) : null
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
    toPositiveNumber(user.weight) !== null &&
    toPositiveNumber(user.age) !== null &&
    hasTextValue(user.grade) &&
    toPositiveNumber(user.resting_heart_rate) !== null
  )
}

function hasRequiredStudyProfileFields(profile: StudentProfile) {
  return (
    profile.age > 0 &&
    profile.grade.trim().length > 0 &&
    profile.restingHeartRate > 0
  )
}

export function mapBackendCurrentUserToStudentProfile(
  user: BackendCurrentUser,
  seedProfile: StudentProfile
): StudentProfile {
  const heightCm = toPositiveNumber(user.height)
  const weightKg = toPositiveNumber(user.weight)
  const age = toPositiveNumber(user.age)
  const restingHeartRate = toPositiveNumber(user.resting_heart_rate)
  const grade = hasTextValue(user.grade) ? user.grade.trim() : ''

  return {
    ...seedProfile,
    studentId: hasTextValue(user.student_id) ? user.student_id.trim() : '',
    name: hasTextValue(user.name) ? user.name.trim() : '',
    gender: resolveBackendGenderLabel(user.gender),
    major: hasTextValue(user.major) ? user.major.trim() : '',
    heightCm: heightCm ?? 0,
    weightKg: weightKg ?? 0,
    age: age ?? seedProfile.age,
    grade: grade || seedProfile.grade,
    restingHeartRate: restingHeartRate ?? seedProfile.restingHeartRate,
    completed: isBackendProfileComplete(user)
  }
}

function buildBootstrapAccessResult(checkpoint?: CheckpointKey): BootstrapAccessResult {
  if (checkpoint) {
    return {
      targetPage: 'questionnaire',
      targetPageUrl: `/pages/access/questionnaire?checkpoint=${checkpoint}`,
      checkpoint
    }
  }

  return {
    targetPage: 'home',
    targetPageUrl: '/pages/training/home'
  }
}

function buildRegistrationAccessResult(): BootstrapAccessResult {
  return {
    targetPage: 'register',
    targetPageUrl: '/pages/access/register'
  }
}

function buildShortQuestionnairePayload(
  input: ShortQuestionnaireSyncInput
): ShortQuestionnaireCreatePayload {
  if (
    !Number.isInteger(input.feelingScale) ||
    input.feelingScale < -5 ||
    input.feelingScale > 5 ||
    !Number.isInteger(input.feltArousalScale) ||
    input.feltArousalScale < 1 ||
    input.feltArousalScale > 6
  ) {
    throw new Error('Short questionnaire responses are outside the FS/FAS domains.')
  }
  return {
    training_session_id: input.sessionId,
    feeling_scale: input.feelingScale,
    felt_arousal_scale: input.feltArousalScale
  }
}

function resolveCompletedPsychologyCheckpoints(
  records: BackendPsychologyRecord[],
  plan?: BackendQuestionnairePlan
) {
  const checkpoints = new Set<CheckpointKey>()
  for (const record of records) {
    if (record?.scale_info && typeof record.scale_info.order === 'number') {
      checkpoints.add(mapPsychologyRecordSummary(record).checkpoint)
    }
  }
  if (
    plan?.checkpoint === 'baseline' &&
    plan.completed_questionnaire_count < plan.questionnaire_count
  ) {
    checkpoints.delete('baseline')
  }
  return checkpoints
}

function hasSequentialCompletedCheckpoints(completedCheckpoints: Set<CheckpointKey>) {
  const order: CheckpointKey[] = ['baseline', 'week4', 'week8', 'week12']
  let foundGap = false

  for (const checkpoint of order) {
    if (!completedCheckpoints.has(checkpoint)) {
      foundGap = true
      continue
    }

    if (foundGap) {
      return false
    }
  }

  return true
}

function isAllScalesCompletedMessage(message: string) {
  const normalized = message.trim().toLowerCase()
  return (
    (normalized.includes('所有') && normalized.includes('完成')) ||
    normalized.includes('all scales completed') ||
    normalized.includes('all scales have been completed')
  )
}

function resolveDueCheckpoint(
  nextScale: Awaited<ReturnType<StudentBackendSyncDependencies['getNextPsychologyScale']>>,
  completedCheckpoints: Set<CheckpointKey>
) {
  if (hasQuestions(nextScale)) {
    const checkpoint = mapBackendScaleToQuestionnaire(nextScale).checkpoint
    if (completedCheckpoints.has(checkpoint)) {
      throw new Error('Backend checkpoint state is inconsistent. Please contact the study administrator.')
    }
    return checkpoint
  }

  if (nextScale && typeof nextScale.message === 'string' && nextScale.message.trim().length > 0) {
    if (isAllScalesCompletedMessage(nextScale.message)) {
      return undefined
    }

    throw new Error(`Backend could not identify the next required questionnaire checkpoint: ${nextScale.message}`)
  }

  throw new Error('Backend could not identify the next required questionnaire checkpoint.')
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
  const questionnairePlanLoader = overrides.getPsychologyQuestionnairePlan
    ?? (Object.keys(overrides).length === 0
      ? dependencies.getPsychologyQuestionnairePlan
      : undefined)
  const submissionOptions = {
    ...resolveDefaultSubmissionOptions(),
    ...submissionOverrides
  } satisfies StudentBackendSubmissionOptions
  const shortQuestionnaireOperations = new Map<string, Promise<void>>()
  let pendingShortQuestionnaireRetry: Promise<{ attempted: number; succeeded: number }> | null = null

  function enqueueShortQuestionnaireOperation<T>(
    sessionId: string,
    operation: () => Promise<T>
  ) {
    const previous = shortQuestionnaireOperations.get(sessionId) ?? Promise.resolve()
    const result = previous.then(operation, operation)
    const settled = result.then(() => undefined, () => undefined)
    shortQuestionnaireOperations.set(sessionId, settled)
    void settled.then(() => {
      if (shortQuestionnaireOperations.get(sessionId) === settled) {
        shortQuestionnaireOperations.delete(sessionId)
      }
    })
    return result
  }

  async function retryPendingShortQuestionnairesNow() {
    const submissions = submissionOptions.pendingShortQuestionnaires.list()
    const submitShortQuestionnaire = dependencies.submitShortQuestionnaire
    if (
      !dependencies.isEnabled() ||
      !submitShortQuestionnaire ||
      submissions.length === 0
    ) {
      return { attempted: 0, succeeded: 0 }
    }

    try {
      await dependencies.ensureSession()
    } catch {
      return { attempted: submissions.length, succeeded: 0 }
    }

    let succeeded = 0
    for (const submission of submissions) {
      const synced = await enqueueShortQuestionnaireOperation(
        submission.sessionId,
        async () => {
          // A concurrent retry or a newer response may have already changed
          // this session while this job waited for its per-session turn.
          const current = submissionOptions.pendingShortQuestionnaires.list()
            .find(item => item.sessionId === submission.sessionId)
          if (!current) {
            return false
          }
          if (
            submissionOptions.pendingSubmissions.list()
              .some(item => item.sessionId === current.sessionId)
          ) {
            return false
          }

          try {
            await submitShortQuestionnaire({
              training_session_id: current.sessionId,
              feeling_scale: current.response.feelingScale,
              felt_arousal_scale: current.response.feltArousalScale
            })
            submissionOptions.pendingShortQuestionnaires.remove(current.sessionId)
            return true
          } catch {
            // Keep failed and ambiguous submissions durable for a later retry.
            return false
          }
        }
      )
      if (synced) {
        succeeded += 1
      }
    }

    return { attempted: submissions.length, succeeded }
  }

  function startPendingShortQuestionnaireRetry() {
    if (pendingShortQuestionnaireRetry) {
      return pendingShortQuestionnaireRetry
    }

    const retry = retryPendingShortQuestionnairesNow()
    pendingShortQuestionnaireRetry = retry
    void retry.then(
      () => {
        if (pendingShortQuestionnaireRetry === retry) {
          pendingShortQuestionnaireRetry = null
        }
      },
      () => {
        if (pendingShortQuestionnaireRetry === retry) {
          pendingShortQuestionnaireRetry = null
        }
      }
    )
    return retry
  }

  async function submitPendingTrainingJob(
    submission: Extract<PendingTrainingSubmission, { kind: 'visual' }>
  ): Promise<BackendExerciseRecord>
  async function submitPendingTrainingJob(
    submission: PendingTrainingSubmission
  ): Promise<unknown>
  async function submitPendingTrainingJob(submission: PendingTrainingSubmission) {
    await dependencies.ensureSession()
    if (submission.kind === 'visual') {
      let videoId = submission.videoId
      if (!videoId) {
        const exerciseType = resolveBackendExerciseType(submission.modality)
        const videos = await dependencies.listExerciseVideos(exerciseType)
        const video = videos.find(item => item.video_file?.trim()) ?? videos[0]
        if (!video) {
          throw new Error(`No backend exercise video is configured for ${exerciseType}.`)
        }
        videoId = video.id
      }

      const hasVerifiedScore = (
        submission.score !== undefined && Boolean(submission.trainingCredential)
      )
      return dependencies.createExerciseRecord({
        video: videoId,
        duration: submission.durationSeconds,
        training_session_id: submission.sessionId,
        client_completed_at: submission.completedAt ?? submission.queuedAt,
        ...(hasVerifiedScore ? { score: submission.score } : {}),
        ...(!hasVerifiedScore && submission.score !== undefined
          ? { score_unavailable_reason: 'legacy_unsigned_pending_score' }
          : submission.scoreUnavailableReason
            ? { score_unavailable_reason: submission.scoreUnavailableReason }
          : {}),
        ...(submission.comment !== undefined ? { comment: submission.comment } : {}),
        ...(submission.poseAnalysis ? { poseAnalysis: submission.poseAnalysis } : {}),
        ...(submission.actionResults ? { actionResults: submission.actionResults } : {}),
        ...(submission.trainingCredential
          ? { training_credential: submission.trainingCredential }
          : {}),
        ...(submission.scoreAlgorithmVersion
          ? { score_algorithm_version: submission.scoreAlgorithmVersion }
          : {}),
        ...(submission.clientVersion
          ? { client_version: submission.clientVersion }
          : {})
      })
    }

    return dependencies.createStairsRecord(buildStairsRecordPayload({
      sessionId: submission.sessionId,
      durationSeconds: submission.durationSeconds,
      completedIntervals: submission.completedIntervals,
      qualityScore: submission.qualityScore,
      summary: submission.summary,
      completedAt: submission.completedAt ?? submission.queuedAt
    }))
  }

  async function retryPendingTrainingSubmissionsNow() {
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
  }

  function retryTrainingBeforeShortQuestionnaires() {
    void retryPendingTrainingSubmissionsNow().then(
      () => startPendingShortQuestionnaireRetry(),
      () => startPendingShortQuestionnaireRetry()
    )
  }

  return {
    isEnabled: dependencies.isEnabled,
    async bootstrapAccess() {
      if (!dependencies.isEnabled()) {
        return buildRegistrationAccessResult()
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

      const storedProfile = submissionOptions.registrationProfileStorage.load()
      const profile = mapBackendCurrentUserToStudentProfile(
        backendUser,
        storedProfile ?? bootstrapAccess.resolveLocalProfile()
      )
      profile.completed = profile.completed && hasRequiredStudyProfileFields(profile)
      if (!profile.completed) {
        bootstrapAccess.hydrateAccessState({
          profile,
          completedQuestionnaireCheckpoints: [],
          activeCheckpoint: 'baseline'
        })
        // After a successful authenticated bootstrap, retry any pending short
        // questionnaires non-blockingly (not only when the page mounts).
        retryTrainingBeforeShortQuestionnaires()
        return buildRegistrationAccessResult()
      }

      const questionnairePlan = questionnairePlanLoader
        ? await questionnairePlanLoader('baseline')
        : undefined
      const completedCheckpoints = resolveCompletedPsychologyCheckpoints(
        psychologyRecords,
        questionnairePlan
      )
      if (!hasSequentialCompletedCheckpoints(completedCheckpoints)) {
        throw new Error('Backend checkpoint records are out of order.')
      }
      const registeredProfileHasNoPsychologyRecords = completedCheckpoints.size === 0 && psychologyRecords.length === 0
      const dueCheckpoint = resolveDueCheckpoint(
        await dependencies.getNextPsychologyScale(),
        completedCheckpoints
      )
      if (registeredProfileHasNoPsychologyRecords && dueCheckpoint !== 'baseline') {
        throw new Error('Backend checkpoint order is invalid: baseline questionnaire is not completed.')
      }

      bootstrapAccess.hydrateAccessState({
        profile,
        completedQuestionnaireCheckpoints: [...completedCheckpoints],
        activeCheckpoint: dueCheckpoint ?? 'baseline'
      })

      // After a successful authenticated bootstrap, retry any pending short
      // questionnaires non-blockingly (not only when the short-questionnaire
      // page mounts). This is a release blocker for questionnaire server
      // collection: the backend endpoint must make training_session_id
      // idempotent/unique and treat repeats as success before the env var
      // can be enabled. See docs/mini-program-production-release.md.
      retryTrainingBeforeShortQuestionnaires()

      return buildBootstrapAccessResult(dueCheckpoint)
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
      if (
        nextScale &&
        'message' in nextScale &&
        typeof nextScale.message === 'string' &&
        isAllScalesCompletedMessage(nextScale.message)
      ) {
        return null
      }

      const scales = await dependencies.listPsychologyScales()
      const preferredScale = preferredCheckpoint
        ? scales.find(scale => mapBackendScaleToQuestionnaire(scale).checkpoint === preferredCheckpoint)
        : undefined
      const fallbackScale = preferredScale ?? scales.find(scale => scale.questions.length > 0)

      return fallbackScale ? mapBackendScaleToQuestionnaire(fallbackScale) : null
    },
    async loadQuestionnairePlan(checkpoint: CheckpointKey = 'baseline') {
      if (!dependencies.isEnabled() || !questionnairePlanLoader) {
        return null
      }
      await dependencies.ensureSession()
      return questionnairePlanLoader(checkpoint)
    },
    async syncRegistration(profile: RegistrationSyncInput) {
      return runIfEnabled(dependencies.isEnabled(), async () => {
        await dependencies.ensureSession()
        await dependencies.updateProfile(mapStudentProfileToUserUpdatePayload(profile))
        submissionOptions.registrationProfileStorage.save(profile)
      })
    },
    async syncShortQuestionnaire(
      input: ShortQuestionnaireSyncInput
    ): Promise<ShortQuestionnaireSyncResult> {
      buildShortQuestionnairePayload(input) // validates FS/FAS domains before durable storage

      const submission = {
        sessionId: input.sessionId,
        response: {
          feelingScale: input.feelingScale,
          feltArousalScale: input.feltArousalScale
        },
        queuedAt: new Date().toISOString()
      } satisfies PendingShortQuestionnaireSubmission
      const submitShortQuestionnaire = dependencies.submitShortQuestionnaire
      if (!dependencies.isEnabled() || !submitShortQuestionnaire) {
        // Serialize only this session's save with its retry/remove. A slow
        // historical response must not keep a newer training feedback waiting.
        return enqueueShortQuestionnaireOperation(input.sessionId, async () => {
          submissionOptions.pendingShortQuestionnaires.save(submission)
          return { synced: false, reason: 'pending-backend-endpoint' } as const
        })
      }

      return enqueueShortQuestionnaireOperation(input.sessionId, async () => {
        // Save before network, while retaining per-session ordering so an
        // older retry cannot delete a newer response for the same session.
        submissionOptions.pendingShortQuestionnaires.save(submission)
        try {
          await dependencies.ensureSession()
          await submitShortQuestionnaire(buildShortQuestionnairePayload(input))
          submissionOptions.pendingShortQuestionnaires.remove(input.sessionId)
          return { synced: true } as const
        } catch {
          // Network/submit failed but the durable save succeeded.
          // Return a truthful result so the page does not claim server
          // completion, and the response stays durable for a later retry.
          return { synced: false, reason: 'network-error' } as const
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
    async loadVisualExerciseVideo(
      modality: VisualSessionSyncInput['modality']
    ): Promise<ExerciseVideoSummary | null> {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      const videos = await dependencies.listExerciseVideos(resolveBackendExerciseType(modality))
      const video = videos.find(item => item.video_file?.trim())

      return video ? resolveExerciseVideoUrl(video) : null
    },
    async loadVisualExerciseArrangement(
      modality: VisualSessionSyncInput['modality']
    ): Promise<ExerciseArrangementDetail | null> {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      const arrangements = await dependencies.listExerciseArrangements(
        resolveBackendExerciseType(modality)
      )
      const candidates = [...arrangements]
        .filter(item => item.is_active !== false)
        .sort((left, right) => left.order - right.order)

      for (const candidate of candidates) {
        const detail = resolveExerciseArrangementUrls(
          await dependencies.getExerciseArrangement(candidate.id)
        )
        if (
          detail.items.length > 0 &&
          detail.items.every(item => item.video.video_file?.trim())
        ) {
          return detail
        }
      }

      return null
    },
    async loadExerciseVideoTutorial(
      videoId: number
    ): Promise<TutorialResponse | null> {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      return resolveTutorialResponseUrls(
        await dependencies.getExerciseVideoTutorial(videoId)
      )
    },
    async prepareVisualTrainingSession(input: {
      sessionId: string
      modality: VisualSessionSyncInput['modality']
      videoId: number
      arrangementId?: number
      arrangementFingerprint?: string
    }): Promise<TrainingCredentialResponse | null> {
      if (!dependencies.isEnabled()) {
        return null
      }
      if (!dependencies.createTrainingCredential) {
        throw new Error('Training credential endpoint is unavailable.')
      }
      await dependencies.ensureSession()
      return dependencies.createTrainingCredential({
        training_session_id: input.sessionId,
        modality: input.modality === 'wushu' ? 'MARTIAL_ARTS' : 'HIIT',
        video_id: input.videoId,
        ...(input.arrangementId ? { arrangement_id: input.arrangementId } : {}),
        ...(input.arrangementFingerprint
          ? { arrangement_fingerprint: input.arrangementFingerprint }
          : {})
      })
    },
    async syncVisualSession(input: VisualSessionSyncInput): Promise<VisualSessionSyncResult> {
      if (!dependencies.isEnabled()) {
        return {
          synced: false,
          reason: 'disabled'
        }
      }

      const completedAt = input.completedAt ?? new Date().toISOString()
      const submission: PendingTrainingSubmission = {
        kind: 'visual',
        sessionId: input.sessionId,
        modality: input.modality,
        durationSeconds: input.durationSeconds,
        ...(input.videoId ? { videoId: input.videoId } : {}),
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(input.scoreUnavailableReason
          ? { scoreUnavailableReason: input.scoreUnavailableReason }
          : {}),
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
        ...(input.poseAnalysis ? { poseAnalysis: input.poseAnalysis } : {}),
        ...(input.actionResults ? { actionResults: input.actionResults } : {}),
        completedAt,
        ...(input.trainingCredential
          ? { trainingCredential: input.trainingCredential }
          : {}),
        ...(input.scoreAlgorithmVersion
          ? { scoreAlgorithmVersion: input.scoreAlgorithmVersion }
          : {}),
        ...(input.clientVersion ? { clientVersion: input.clientVersion } : {}),
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

      const completedAt = input.completedAt ?? new Date().toISOString()
      const submission: PendingTrainingSubmission = {
        kind: 'stairs',
        sessionId: input.sessionId,
        durationSeconds: input.durationSeconds,
        completedIntervals: input.completedIntervals,
        qualityScore: input.qualityScore,
        summary: input.summary,
        completedAt,
        queuedAt: new Date().toISOString()
      }
      submissionOptions.pendingSubmissions.save(submission)
      await submitPendingTrainingJob(submission)
      submissionOptions.pendingSubmissions.remove(input.sessionId)
      return { synced: true } as const
    },
    async retryPendingTrainingSubmissions() {
      return retryPendingTrainingSubmissionsNow()
    },
    async retryPendingShortQuestionnaires() {
      return startPendingShortQuestionnaireRetry()
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
    async loadTrainingSession(sessionId: string) {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      const [exerciseRecords, stairRecords] = await Promise.all([
        dependencies.listExerciseRecords(),
        dependencies.listStairRecords()
      ])
      return mapBackendTrainingHistory(exerciseRecords, stairRecords)
        .find(session => session.id === sessionId) ?? null
    },
    async loadTrainingProgress() {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      return dependencies.getTrainingProgress()
    },
    async loadAchievementAwards() {
      if (!dependencies.isEnabled() || !dependencies.getAchievementAwards) {
        return null
      }

      await dependencies.ensureSession()
      return dependencies.getAchievementAwards()
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
    async loadVisualScoreTrend() {
      if (!dependencies.isEnabled()) {
        return null
      }

      await dependencies.ensureSession()
      const trend = await dependencies.getExerciseScoreTrend()
      return mapBackendVisualScoreTrend(trend)
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
        totalTrainingDays: compliance.active_days ?? compliance.total_training_days,
        completedDays: compliance.qualifying_days ?? compliance.completed_days,
        complianceRate: compliance.qualification_rate ?? compliance.compliance_rate,
        calendar: calendar.days.map(day => ({
          date: day.date,
          completedSessions: day.training_count,
          status: (day.is_qualifying_day ?? day.is_completed)
            ? 'met-goal' as const
            : (day.is_active_day ?? day.training_count > 0)
              ? 'partial' as const
              : 'none' as const
        })),
        trend: trend.trend.map(point => ({
          period: point.period,
          label: point.label,
          trainingDays: point.active_days ?? point.training_days,
          totalCount: point.total_count,
          completedDays: point.qualifying_days ?? point.completed_days,
          completionRate: point.qualification_rate ?? point.completion_rate
        }))
      }
    }
  }
}

export const studentBackendSync = createStudentBackendSync()
