import type { CompletionInput } from '../../domain/student/training'
import type {
  SessionRecord,
  SessionScoreDetails,
  TrainingModality
} from '../../domain/student/types'
import type {
  ActionAngleName,
  ActionAngleScoreDetail,
  ActionScoreDirection,
  ScoredActionResult
} from '../../domain/training/actionScoringTypes'
import { toShanghaiDate } from '../../domain/student/shanghaiTime'
import type { ExerciseArrangementSummary } from '../../uni-app/api/studentBackendTypes'

export function isTrainingMockEnabled() {
  return import.meta.env.VITE_TRAINING_MOCK_ENABLED?.trim().toLowerCase() === 'true'
}

export function buildMockExerciseArrangements(
  modality: Exclude<TrainingModality, 'stair'>
): ExerciseArrangementSummary[] {
  if (modality === 'hiit') {
    return [
      {
        id: 9001,
        title: 'Mock · 自重抗阻基础套组',
        description: '深蹲、开合跳与平板支撑组合。',
        exercise_type: 'HIIT',
        item_count: 3,
        total_duration: 90,
        is_active: true,
        order: 1
      },
      {
        id: 9002,
        title: 'Mock · 自重抗阻进阶套组',
        description: '用于验证较高强度训练后的反馈展示。',
        exercise_type: 'HIIT',
        item_count: 3,
        total_duration: 120,
        is_active: true,
        order: 2
      }
    ]
  }

  return [
    {
      id: 9101,
      title: 'Mock · 八段锦基础套组',
      description: '起势、双手托天与左右开弓组合。',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 3,
      total_duration: 120,
      is_active: true,
      order: 1
    },
    {
      id: 9102,
      title: 'Mock · 传统养生进阶套组',
      description: '用于验证传统体育养生训练反馈。',
      exercise_type: 'MARTIAL_ARTS',
      item_count: 3,
      total_duration: 150,
      is_active: true,
      order: 2
    }
  ]
}

function createMockSessionId() {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `mock-${Date.now()}-${randomPart}`
}

function angleDetail(
  score: number,
  direction: ActionScoreDirection = 'too_small'
): ActionAngleScoreDetail {
  const error = Number(((100 - score) / 100).toFixed(2))
  return {
    enabled: true,
    weight: 1,
    normalized_weight: 1,
    score,
    mean_error: error,
    mean_signed_error: direction === 'too_small' ? -error : error,
    max_error: Number((error * 1.35).toFixed(2)),
    tolerance: 0.18,
    direction,
    over_tolerance: score < 82
  }
}

function createAction(
  itemId: number,
  videoId: number,
  actionId: string,
  title: string,
  score: number,
  angles: Array<[ActionAngleName, number, ActionScoreDirection?]>,
  feedbackMessage?: string
): ScoredActionResult {
  const angleDetails = Object.fromEntries(
    angles.map(([key, angleScore, direction]) => [
      key,
      angleDetail(angleScore, direction)
    ])
  ) as ScoredActionResult['angleDetails']
  const feedbackAngle = angles.at(-1)?.[0]

  return {
    itemId,
    videoId,
    actionId,
    title,
    expectedDuration: 30,
    score,
    passed: score >= 60,
    feedback: feedbackMessage && feedbackAngle
      ? [{
          angle: feedbackAngle,
          direction: 'too_small',
          message: feedbackMessage,
          severity: 'warning'
        }]
      : [],
    angleDetails,
    frameCount: 150
  }
}

function createMockScoreDetails(
  modality: Exclude<TrainingModality, 'stair'>,
  arrangementId = 1
): SessionScoreDetails {
  const itemBase = Math.max(1, arrangementId) * 100
  const isHiit = modality === 'hiit'
  const actionResults = isHiit
    ? [
        createAction(itemBase + 1, itemBase + 11, 'mock-squat', '标准深蹲', 91, [
          ['left_hip', 92], ['right_hip', 91], ['left_knee', 89], ['right_knee', 90]
        ]),
        createAction(itemBase + 2, itemBase + 12, 'mock-jumping-jack', '开合跳', 86, [
          ['left_shoulder', 88], ['right_shoulder', 87], ['left_knee', 84], ['right_knee', 85]
        ]),
        createAction(itemBase + 3, itemBase + 13, 'mock-plank', '平板支撑', 82, [
          ['left_shoulder', 85], ['right_shoulder', 84], ['left_hip', 80], ['right_hip', 81]
        ], '保持髋部稳定，避免动作末段下沉。')
      ]
    : [
        createAction(itemBase + 1, itemBase + 11, 'mock-opening', '八段锦起势', 94, [
          ['left_shoulder', 95], ['right_shoulder', 94], ['left_elbow', 92], ['right_elbow', 93],
          ['left_hip', 91], ['right_hip', 90], ['left_knee', 92], ['right_knee', 91]
        ]),
        createAction(itemBase + 2, itemBase + 12, 'mock-lift-sky', '双手托天理三焦', 90, [
          ['left_shoulder', 91], ['right_shoulder', 90], ['left_elbow', 89], ['right_elbow', 90],
          ['left_hip', 88], ['right_hip', 87], ['left_knee', 90], ['right_knee', 89]
        ]),
        createAction(itemBase + 3, itemBase + 13, 'mock-draw-bow', '左右开弓似射雕', 87, [
          ['left_elbow', 88], ['right_elbow', 87], ['torso_rotation', 85, 'too_large'],
          ['left_hip', 86], ['right_hip', 85], ['left_knee', 88], ['right_knee', 87]
        ], '转体幅度可以略微收小，让重心保持在身体中线。')
      ]
  const overallScore = isHiit ? 86 : 91
  const dimensions = isHiit
    ? [
        { key: 'left_shoulder', label: '左肩', score: 88 },
        { key: 'right_shoulder', label: '右肩', score: 87 },
        { key: 'left_hip', label: '左髋', score: 86 },
        { key: 'right_hip', label: '右髋', score: 85 },
        { key: 'left_knee', label: '左膝', score: 88 },
        { key: 'right_knee', label: '右膝', score: 89 }
      ]
    : [
        { key: 'left_shoulder', label: '左肩', score: 93 },
        { key: 'right_shoulder', label: '右肩', score: 92 },
        { key: 'left_elbow', label: '左肘', score: 91 },
        { key: 'right_elbow', label: '右肘', score: 90 },
        { key: 'torso_rotation', label: '躯干旋转', score: 87 },
        { key: 'left_hip', label: '左髋', score: 89 },
        { key: 'right_hip', label: '右髋', score: 88 },
        { key: 'left_knee', label: '左膝', score: 90 },
        { key: 'right_knee', label: '右膝', score: 89 }
      ]
  const summary = isHiit
    ? '整体节奏稳定，深蹲完成度最好；平板支撑末段注意收紧核心、保持髋部高度。'
    : '动作舒展连贯，肩肘控制稳定；左右开弓时略收转体幅度，重心会更平稳。'

  return {
    overallScore,
    summary,
    dimensions,
    highlights: [isHiit ? '深蹲动作稳定' : '上肢舒展充分', '训练节奏连贯'],
    warnings: [isHiit ? '平板支撑末段髋部略低' : '左右开弓转体幅度略大'],
    actionResults,
    chartSnapshot: { radar: dimensions }
  }
}

export interface BuildMockTrainingOptions {
  modality: Exclude<TrainingModality, 'stair'>
  arrangementId?: number
  sessionId?: string
  completedAt?: string
}

export function buildMockTrainingCompletion(
  options: BuildMockTrainingOptions
): CompletionInput & { sessionId: string; completedAt: string } {
  const completedAt = options.completedAt ?? new Date().toISOString()
  const scoreDetails = createMockScoreDetails(
    options.modality,
    options.arrangementId
  )
  return {
    sessionId: options.sessionId?.trim() || createMockSessionId(),
    modality: options.modality,
    qualityScore: scoreDetails.overallScore,
    summary: scoreDetails.summary,
    capturedBy: 'camera',
    completedAt,
    countsAsCompletion: true,
    scoreDetails
  }
}

export function buildMockTrainingSession(options: BuildMockTrainingOptions): SessionRecord {
  const completion = buildMockTrainingCompletion(options)
  return {
    id: completion.sessionId,
    modality: completion.modality,
    date: toShanghaiDate(completion.completedAt),
    completed: true,
    validCheckInApplied: true,
    restartedAfterInterrupt: false,
    shortQuestionnaire: null,
    analysis: {
      qualityScore: completion.qualityScore,
      summary: completion.summary,
      capturedBy: completion.capturedBy,
      scoreDetails: completion.scoreDetails
    }
  }
}

export function buildMockTrainingTrend(date: string, score: number) {
  const parsed = new Date(`${date}T12:00:00+08:00`)
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const scores = [score - 11, score - 8, score - 7, score - 3, score - 4, score]
  return scores.map((pointScore, index) => {
    const pointDate = new Date(safeDate)
    pointDate.setUTCDate(pointDate.getUTCDate() - (scores.length - index - 1) * 3)
    return {
      date: toShanghaiDate(pointDate.toISOString()),
      score: Math.max(0, Math.min(100, pointScore))
    }
  })
}
