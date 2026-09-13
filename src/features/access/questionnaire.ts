import type { CheckpointKey } from '../../types/student'

export interface LongQuestion {
  id: string
  prompt: string
}

export interface LongQuestionnaireSubmission {
  checkpoint: CheckpointKey
  responses: Record<string, number>
  score: number
  percentage: number
  submittedAt: string
}

export const CHECKPOINT_LABELS: Record<CheckpointKey, string> = {
  baseline: '基线',
  daily: '每日',
  week4: '第4周',
  week8: '第8周',
  week12: '第12周'
}

const SHARED_LONG_QUESTIONS: LongQuestion[] = [
  { id: 'stress-control', prompt: '我能在困难时刻保持冷静。' },
  { id: 'focus', prompt: '我能在较长时间内把注意力集中在一件事情上。' },
  { id: 'sleep-quality', prompt: '我的睡眠质量能够支持日常训练和恢复。' },
  { id: 'motivation', prompt: '我有动力继续完成训练计划。' },
  { id: 'confidence', prompt: '我对自己的身心进步有信心。' }
]

export const LONG_QUESTIONNAIRES: Record<CheckpointKey, LongQuestion[]> = {
  baseline: SHARED_LONG_QUESTIONS,
  daily: SHARED_LONG_QUESTIONS,
  week4: SHARED_LONG_QUESTIONS,
  week8: SHARED_LONG_QUESTIONS,
  week12: SHARED_LONG_QUESTIONS
}

export function normalizeCheckpoint(value: string | undefined): CheckpointKey {
  if (value === 'daily' || value === 'week4' || value === 'week8' || value === 'week12') {
    return value
  }

  return 'baseline'
}

export function evaluateLongQuestionnaire(
  checkpoint: CheckpointKey,
  responses: Record<string, number>
): LongQuestionnaireSubmission {
  const responseValues = Object.values(responses)
  const score = responseValues.reduce((sum, value) => sum + value, 0)
  const maxScore = responseValues.length * 5
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100)

  return {
    checkpoint,
    responses,
    score,
    percentage,
    submittedAt: new Date().toISOString()
  }
}
