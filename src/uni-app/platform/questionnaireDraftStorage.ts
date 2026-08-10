import type { PsychologyQuestionnaireAnswer } from '../api/studentBackendTypes'

export interface QuestionnaireDraft {
  studentId: string
  scaleId: number
  checkpoint: string
  answers: Record<number, PsychologyQuestionnaireAnswer>
  currentQuestionIndex: number
  updatedAt: string
}

interface StoredQuestionnaireDraft extends QuestionnaireDraft {
  version: 2
}

interface QuestionnaireDraftPlatform {
  getStorageSync: (key: string) => unknown
  setStorageSync: (key: string, value: unknown) => void
  removeStorageSync?: (key: string) => void
}

const storagePrefix = 'sport-snack:questionnaire-draft:v2'

function storageKey(studentId: string, checkpoint: string, scaleId: number) {
  return `${storagePrefix}:${encodeURIComponent(studentId.trim())}:${checkpoint}:${scaleId}`
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function normalizeAnswers(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const answers: Record<number, PsychologyQuestionnaireAnswer> = {}
  for (const [questionId, answer] of Object.entries(value)) {
    const normalizedQuestionId = Number(questionId)
    if (!isPositiveInteger(normalizedQuestionId)) {
      return null
    }

    if (answer === 0 || (Array.isArray(answer) && answer.length === 0)) {
      continue
    }

    const isValidAnswer = isPositiveInteger(answer)
      || (Array.isArray(answer) && answer.every(isPositiveInteger))
      || (typeof answer === 'string' && answer.trim().length > 0)
    if (!isValidAnswer) return null

    answers[normalizedQuestionId] = answer
  }
  return answers
}

export function createQuestionnaireDraftStorage(
  platform?: QuestionnaireDraftPlatform
) {
  const resolvedPlatform = platform ?? uni
  return {
    load(studentId: string, checkpoint: string, scaleId: number): QuestionnaireDraft | null {
      const normalizedStudentId = studentId.trim()
      if (!normalizedStudentId) return null

      try {
        const stored = resolvedPlatform.getStorageSync(storageKey(normalizedStudentId, checkpoint, scaleId)) as
          Partial<StoredQuestionnaireDraft> | null
        if (
          !stored ||
          stored.version !== 2 ||
          stored.studentId !== normalizedStudentId ||
          stored.checkpoint !== checkpoint ||
          stored.scaleId !== scaleId ||
          typeof stored.currentQuestionIndex !== 'number' ||
          !Number.isInteger(stored.currentQuestionIndex) ||
          stored.currentQuestionIndex < 0 ||
          typeof stored.updatedAt !== 'string' ||
          Number.isNaN(Date.parse(stored.updatedAt))
        ) {
          return null
        }

        const answers = normalizeAnswers(stored.answers)
        if (!answers) return null

        return {
          studentId: normalizedStudentId,
          scaleId,
          checkpoint,
          answers,
          currentQuestionIndex: stored.currentQuestionIndex,
          updatedAt: stored.updatedAt
        }
      } catch {
        return null
      }
    },

    save(draft: QuestionnaireDraft) {
      const normalizedStudentId = draft.studentId.trim()
      if (!normalizedStudentId) return

      const stored: StoredQuestionnaireDraft = {
        version: 2,
        ...draft,
        studentId: normalizedStudentId,
        answers: { ...draft.answers }
      }
      resolvedPlatform.setStorageSync(
        storageKey(normalizedStudentId, draft.checkpoint, draft.scaleId),
        stored
      )
    },

    clear(studentId: string, checkpoint: string, scaleId: number) {
      const normalizedStudentId = studentId.trim()
      if (!normalizedStudentId) return

      const key = storageKey(normalizedStudentId, checkpoint, scaleId)
      if (resolvedPlatform.removeStorageSync) {
        resolvedPlatform.removeStorageSync(key)
        return
      }
      resolvedPlatform.setStorageSync(key, null)
    }
  }
}

export const questionnaireDraftStorage = {
  load(studentId: string, checkpoint: string, scaleId: number) {
    return createQuestionnaireDraftStorage().load(studentId, checkpoint, scaleId)
  },
  save(draft: QuestionnaireDraft) {
    createQuestionnaireDraftStorage().save(draft)
  },
  clear(studentId: string, checkpoint: string, scaleId: number) {
    createQuestionnaireDraftStorage().clear(studentId, checkpoint, scaleId)
  }
}
