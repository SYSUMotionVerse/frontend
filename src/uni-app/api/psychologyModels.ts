import type { CheckpointKey } from '../../types/student'
import type {
  BackendPsychologyRecord,
  BackendPsychologyScale,
  BackendPsychologyScaleSummary,
  PsychologyQuestionnaireAnswer,
  PsychologyQuestionnaireModel,
  PsychologyScaleSubmitPayload
} from './studentBackendTypes'

const CHECKPOINT_BY_ORDER: Record<number, CheckpointKey> = {
  1: 'baseline',
  2: 'week4',
  3: 'week8',
  4: 'week12'
}

function toNullableNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function resolveCheckpointFromScaleOrder(order: number): CheckpointKey {
  return CHECKPOINT_BY_ORDER[order] ?? 'baseline'
}

export function mapBackendScaleToQuestionnaire(
  scale: BackendPsychologyScale
): PsychologyQuestionnaireModel {
  return {
    scaleId: scale.id,
    title: scale.title,
    description: scale.description,
    checkpoint: scale.checkpoint ?? resolveCheckpointFromScaleOrder(scale.order),
    ...(scale.short_title ? { shortTitle: scale.short_title } : {}),
    ...(scale.instructions ? { instructions: scale.instructions } : {}),
    ...(scale.response_legend ? { responseLegend: scale.response_legend } : {}),
    ...(scale.estimated_minutes !== undefined
      ? { estimatedMinutes: scale.estimated_minutes }
      : {}),
    questions: [...scale.questions]
      .sort((left, right) => left.order - right.order)
      .map(question => ({
        id: question.id,
        prompt: question.question_text,
        ...(question.source_order !== undefined
          ? { sourceOrder: question.source_order }
          : {}),
        ...(question.dimension !== undefined
          ? { dimension: question.dimension }
          : {}),
        ...(question.response_config !== undefined
          ? { responseConfig: question.response_config }
          : {}),
        ...(question.question_type !== 'SINGLE'
          ? { questionType: question.question_type }
          : {}),
        options: [...question.options]
          .sort((left, right) => left.order - right.order)
          .map(option => ({
            id: option.id,
            label: option.option_text,
            score: option.score,
            order: option.order
          }))
      }))
  }
}

export function buildPsychologyScaleSubmitPayload(
  scaleId: number,
  answers: Record<number, PsychologyQuestionnaireAnswer>
): PsychologyScaleSubmitPayload {
  return {
    scale_id: scaleId,
    answers: Object.entries(answers)
      .map(([questionId, answer]) => Array.isArray(answer)
        ? {
            question_id: Number(questionId),
            selected_options: answer
          }
          : typeof answer === 'number'
          ? {
              question_id: Number(questionId),
              selected_options: [answer]
            }
          : typeof answer === 'string'
            ? {
              question_id: Number(questionId),
              selected_options: [],
              text_answer: answer
            }
            : {
                question_id: Number(questionId),
                selected_options: [answer.selectedOptionId],
                text_answer: answer.text
              })
      .sort((left, right) => left.question_id - right.question_id)
  }
}

export function calculatePsychologyPercentage(
  scale: BackendPsychologyScale,
  totalScore: number | string | null
): number | null {
  const normalizedTotalScore = toNullableNumber(totalScore)
  if (normalizedTotalScore === null) {
    return null
  }

  const maxScore = scale.questions.reduce((sum, question) => {
    const maxOptionScore = question.options.reduce((currentMax, option) =>
      Math.max(currentMax, option.score), 0)
    return sum + maxOptionScore
  }, 0)

  if (maxScore <= 0) {
    return null
  }

  return Math.round((normalizedTotalScore / maxScore) * 100)
}

function hasQuestionDetails(
  scale: BackendPsychologyScaleSummary | BackendPsychologyScale
): scale is BackendPsychologyScale {
  return Array.isArray((scale as Partial<BackendPsychologyScale>).questions)
}

function toPercentage(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }

  return null
}

export function mapPsychologyRecordSummary(record: BackendPsychologyRecord) {
  const normalizedScore = toNullableNumber(record.total_score)
  const submittedPercentage = toPercentage(record.percentage)
  const scoringStatus = record.scoring_status
    ?? (normalizedScore !== null || submittedPercentage !== null
      ? 'computed'
      : 'raw_only')
  return {
    checkpoint: record.scale_info.checkpoint
      ?? resolveCheckpointFromScaleOrder(record.scale_info.order),
    title: record.scale_info.title,
    score: scoringStatus === 'raw_only' ? null : normalizedScore,
    percentage: scoringStatus === 'raw_only'
      ? null
      : submittedPercentage
        ?? (hasQuestionDetails(record.scale_info)
          ? calculatePsychologyPercentage(record.scale_info, record.total_score)
          : null),
    analysis: record.analysis,
    submittedAt: record.completed_at,
    ...(record.scoring_status ? { scoringStatus: record.scoring_status } : {})
  }
}
