import type {
  PsychologyQuestionnaireModel,
  PsychologyQuestionnaireQuestion
} from '../../uni-app/api/studentBackendTypes'

const ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const

type QuestionnaireDisplayItem = {
  order?: number | null
  task_type?: 'QUESTIONNAIRE' | 'STROOP' | null
  taskType?: 'QUESTIONNAIRE' | 'STROOP' | null
  checkpoint?: string | null
  title?: string | null
  short_title?: string | null
  shortTitle?: string | null
}

export const STUDY_TITLE = '大学生身心状态、健康行为与认知调查问卷'
export const STUDY_ESTIMATED_TIME_LABEL = '10–15'

export function questionnaireDisplayName(
  item: QuestionnaireDisplayItem,
  fallbackOrder = 1
) {
  const taskType = item.task_type ?? item.taskType
  if (taskType === 'STROOP') return '颜色判断任务'

  const rawTitle = item.title?.trim() || item.short_title?.trim() || item.shortTitle?.trim()
  if (item.checkpoint && item.checkpoint !== 'baseline') return rawTitle || '问卷'
  if (rawTitle && isGenericQuestionnaireTitle(rawTitle)) return rawTitle

  const order = Number(item.order ?? fallbackOrder)
  const ordinal = Number.isInteger(order) && order >= 1 && order <= ORDINALS.length
    ? ORDINALS[order - 1]
    : String(order)
  return `问卷${ordinal}`
}

export function isGenericQuestionnaireTitle(title: string) {
  return /^问卷(?:[一二三四五六七八九十]|\d+)$/.test(title.trim())
}

export function questionUsesConfiguredOptionNumbering(
  question: PsychologyQuestionnaireQuestion
) {
  const value = Number(question.responseConfig?.option_number_start)
  return Number.isInteger(value) ? value : null
}

export function questionnaireRunnerDisplayName(
  questionnaire: PsychologyQuestionnaireModel,
  questionnaireNumber: number
) {
  return questionnaireDisplayName({
    taskType: questionnaire.taskType,
    order: questionnaire.order ?? questionnaireNumber,
    checkpoint: questionnaire.checkpoint,
    title: questionnaire.title,
    shortTitle: questionnaire.shortTitle
  })
}
