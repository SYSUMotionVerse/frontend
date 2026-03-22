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
  baseline: 'Baseline',
  week4: 'Week 4',
  week8: 'Week 8',
  week12: 'Week 12'
}

const SHARED_LONG_QUESTIONS: LongQuestion[] = [
  { id: 'stress-control', prompt: 'I can stay calm during difficult moments.' },
  { id: 'focus', prompt: 'I can keep my attention on one task for a long period.' },
  { id: 'sleep-quality', prompt: 'My sleep quality supports daily training and recovery.' },
  { id: 'motivation', prompt: 'I feel motivated to continue the training plan.' },
  { id: 'confidence', prompt: 'I feel confident about my physical and mental progress.' }
]

export const LONG_QUESTIONNAIRES: Record<CheckpointKey, LongQuestion[]> = {
  baseline: SHARED_LONG_QUESTIONS,
  week4: SHARED_LONG_QUESTIONS,
  week8: SHARED_LONG_QUESTIONS,
  week12: SHARED_LONG_QUESTIONS
}

export function normalizeCheckpoint(value: string | undefined): CheckpointKey {
  if (value === 'week4' || value === 'week8' || value === 'week12') {
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

