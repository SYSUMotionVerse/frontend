<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import LongQuestionnaireForm from '../../../components/access/LongQuestionnaireForm.vue'
import {
  CHECKPOINT_LABELS,
  normalizeCheckpoint
} from '../../../features/access/questionnaire'
import type { CheckpointKey } from '../../../domain/student/types'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { markProtectedStudentAccessComplete } from '../../composables/useNavigationGuard'
import { useSubmissionHandoff } from '../../composables/useSubmissionHandoff'
import { buildMiniProgramQueryString } from '../../platform/queryString'
import {
  questionnaireDraftStorage,
  type QuestionnaireDraft
} from '../../platform/questionnaireDraftStorage'
import type {
  BackendQuestionnairePlan,
  LongQuestionnaireSyncResult,
  PsychologyQuestionnaireAnswer,
  PsychologyQuestionnaireModel
} from '../../api/studentBackendTypes'

interface ConfirmedQuestionnaireSubmission {
  scaleId: number
  result: LongQuestionnaireSyncResult & {
    synced: true
    score: number
    percentage: number
    submittedAt: string
  }
}

const store = useStudentStore()
const checkpoint = ref<CheckpointKey>('baseline')
const questionnaire = shallowRef<PsychologyQuestionnaireModel | null>(null)
const isLoading = shallowRef(true)
const hasLoaded = shallowRef(false)
const isSubmitting = shallowRef(false)
const loadErrorMessage = shallowRef('')
const submitErrorMessage = shallowRef('')
const confirmedSubmission = shallowRef<ConfirmedQuestionnaireSubmission | null>(null)
const isLoadingNextQuestionnaire = shallowRef(false)
const nextQuestionnaireError = shallowRef('')
const isFinishingCheckpoint = shallowRef(false)
const checkpointCompletionError = shallowRef('')
const questionnaireDraft = shallowRef<QuestionnaireDraft | null>(null)
const questionnairePlan = shallowRef<BackendQuestionnairePlan | null>(null)
const questionnaireRunnerKey = shallowRef(0)
const draftStudentId = computed(() => String(store.state.profile?.studentId ?? '').trim())
const draftSaveDelayMs = 250
const navigationTimeoutMs = 5_000
const submissionHandoffDelayMs = 260
const { waitForConfirmation } = useSubmissionHandoff({
  delayMs: submissionHandoffDelayMs
})
let pendingDraft: QuestionnaireDraft | null = null
let draftSaveTimer: ReturnType<typeof setTimeout> | undefined
let hasFinalizedCheckpoint = false

onLoad((query) => {
  const nextQuery = query ?? {}
  checkpoint.value = normalizeCheckpoint(nextQuery.checkpoint?.toString())
  void loadQuestionnaire()
})

const checkpointLabel = computed(() => CHECKPOINT_LABELS[checkpoint.value])
const title = computed(() => checkpoint.value === 'baseline' ? '基线问卷' : `${checkpointLabel.value}问卷`)
const subtitle = computed(() => '请根据自己的真实情况作答，没有标准答案。')
const submitLabel = computed(() => submitErrorMessage.value ? '重新提交答案' : '提交答案')
const estimatedMinutes = computed(() =>
  questionnairePlan.value?.estimated_total_minutes
    ?? questionnaire.value?.estimatedMinutes
    ?? Math.max(3, Math.ceil(((questionnaire.value?.questions?.length ?? 0) * 8) / 60))
)
const questionnaireCount = computed(() =>
  questionnairePlan.value?.questionnaire_count ?? 1
)
const questionnaireNumber = computed(() => {
  const scaleId = questionnaire.value?.scaleId
  const entry = questionnairePlan.value?.questionnaires.find(item => item.id === scaleId)
  return entry?.order ?? 1
})

onMounted(() => {
  if (hasLoaded.value) {
    return
  }

  void loadQuestionnaire()
})

onHide(() => {
  flushDraftSave()
})

onBeforeUnmount(() => {
  flushDraftSave()
})

async function loadQuestionnaire() {
  // A reload remounts the runner. Persist the latest in-memory checkpoint
  // first so a fast answer cannot be replaced by an older stored snapshot.
  flushDraftSave()
  hasLoaded.value = true
  isLoading.value = true
  loadErrorMessage.value = ''

  try {
    const loadPlan = typeof studentBackendSync.loadQuestionnairePlan === 'function'
      ? studentBackendSync.loadQuestionnairePlan(checkpoint.value)
      : Promise.resolve(null)
    const [loadedQuestionnaire, loadedPlan] = await Promise.all([
      studentBackendSync.loadLongQuestionnaire(checkpoint.value),
      loadPlan
    ])
    questionnaire.value = loadedQuestionnaire
    questionnaireRunnerKey.value += 1
    questionnairePlan.value = loadedPlan
    questionnaireDraft.value = loadedQuestionnaire && draftStudentId.value
      ? questionnaireDraftStorage.load(
          draftStudentId.value,
          checkpoint.value,
          loadedQuestionnaire.scaleId
        )
      : null
  } catch (error) {
    questionnaire.value = null
    questionnaireDraft.value = null
    loadErrorMessage.value = '问卷加载失败，请检查网络后重试。'
    reportBackendSyncError('问卷加载', error)
  } finally {
    isLoading.value = false
  }
}

async function handleSubmit(payload: {
  scaleId: number
  answers: Record<number, PsychologyQuestionnaireAnswer>
  title: string
}) {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  submitErrorMessage.value = ''
  flushDraftSave()
  try {
    const result = await studentBackendSync.syncLongQuestionnaire({
      checkpoint: checkpoint.value,
      ...payload
    })

    if (!result.synced || result.score === undefined || result.percentage === undefined || !result.submittedAt) {
      submitErrorMessage.value = '问卷提交失败，请检查网络后重新提交。'
      return
    }

    pendingDraft = null
    questionnaireDraftStorage.clear(draftStudentId.value, checkpoint.value, payload.scaleId)
    questionnaireDraft.value = null
    confirmedSubmission.value = {
      scaleId: payload.scaleId,
      result: {
        ...result,
        synced: true,
        score: result.score,
        percentage: result.percentage,
        submittedAt: result.submittedAt
      }
    }

    if (!await waitForConfirmation()) {
      return
    }

    if (hasRemainingQuestionnaire(payload.scaleId)) {
      await loadNextQuestionnaire()
      return
    }

    await finishCheckpoint(result)
  } catch (error) {
    reportBackendSyncError('问卷同步', error)
    submitErrorMessage.value = '问卷提交失败，请检查网络后重新提交。'
  } finally {
    isSubmitting.value = false
  }
}

async function loadNextQuestionnaire() {
  const submission = confirmedSubmission.value
  if (!submission || isLoadingNextQuestionnaire.value) {
    return
  }

  isLoadingNextQuestionnaire.value = true
  nextQuestionnaireError.value = ''
  try {
    const nextQuestionnaire = await studentBackendSync.loadLongQuestionnaire(checkpoint.value)
    if (!nextQuestionnaire || nextQuestionnaire.checkpoint !== checkpoint.value) {
      await finishCheckpoint(submission.result)
      return
    }

    markQuestionnaireComplete(submission.scaleId, nextQuestionnaire.scaleId)
    questionnaire.value = nextQuestionnaire
    questionnaireRunnerKey.value += 1
    questionnaireDraft.value = draftStudentId.value
      ? questionnaireDraftStorage.load(
          draftStudentId.value,
          checkpoint.value,
          nextQuestionnaire.scaleId
        )
      : null
    confirmedSubmission.value = null
    void uni.showToast({
      title: '本份已保存，继续下一份',
      icon: 'none'
    })
  } catch (error) {
    reportBackendSyncError('下一份问卷加载', error)
    nextQuestionnaireError.value = '下一份问卷暂时无法加载，请检查网络后重试。'
  } finally {
    isLoadingNextQuestionnaire.value = false
  }
}

async function finishCheckpoint(result: ConfirmedQuestionnaireSubmission['result']) {
  if (isFinishingCheckpoint.value) {
    return
  }

  isFinishingCheckpoint.value = true
  checkpointCompletionError.value = ''
  try {
    if (!hasFinalizedCheckpoint) {
      store.submitLongQuestionnaire(checkpoint.value, 0, 100)
      markProtectedStudentAccessComplete()
      hasFinalizedCheckpoint = true
    }

    const queryString = buildMiniProgramQueryString({
      checkpoint: checkpoint.value,
      score: '0',
      percentage: '100',
      questionnaireCount: String(questionnairePlan.value?.questionnaire_count ?? 1),
      submittedAt: result.submittedAt
    })

    await redirectToQuestionnaireResult(
      `/pages/access/questionnaire-result?${queryString}`
    )
  } catch (error) {
    reportBackendSyncError('问卷结果跳转', error)
    checkpointCompletionError.value = '问卷已提交，但结果页暂时无法打开。'
  } finally {
    isFinishingCheckpoint.value = false
  }
}

function redirectToQuestionnaireResult(url: string) {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      settle(() => reject(new Error('Questionnaire result navigation timed out.')))
    }, navigationTimeoutMs)

    function settle(action: () => void) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      action()
    }

    try {
      Promise.resolve(uni.redirectTo({ url })).then(
        () => settle(resolve),
        error => settle(() => reject(error))
      )
    } catch (error) {
      settle(() => reject(error))
    }
  })
}

function handleDraftChange(payload: {
  answers: Record<number, PsychologyQuestionnaireAnswer>
  currentQuestionIndex: number
}) {
  if (!questionnaire.value) return
  if (!draftStudentId.value) return

  const draft: QuestionnaireDraft = {
    studentId: draftStudentId.value,
    checkpoint: checkpoint.value,
    scaleId: questionnaire.value.scaleId,
    answers: payload.answers,
    currentQuestionIndex: payload.currentQuestionIndex,
    updatedAt: new Date().toISOString()
  }
  // Keep the current checkpoint in reactive memory immediately. Storage is
  // still debounced, but any runner remount now receives the newest answers.
  questionnaireDraft.value = draft
  pendingDraft = draft
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer)
  }
  draftSaveTimer = setTimeout(flushDraftSave, draftSaveDelayMs)
}

function flushDraftSave() {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer)
    draftSaveTimer = undefined
  }
  if (!pendingDraft) return

  questionnaireDraftStorage.save(pendingDraft)
  pendingDraft = null
}

function hasRemainingQuestionnaire(scaleId: number) {
  const plan = questionnairePlan.value
  if (!plan) return false

  return plan.questionnaires.some(item => item.id !== scaleId && !item.completed)
}

function markQuestionnaireComplete(scaleId: number, nextScaleId: number) {
  const plan = questionnairePlan.value
  if (!plan) return

  questionnairePlan.value = {
    ...plan,
    completed_questionnaire_count: Math.min(
      plan.questionnaire_count,
      plan.completed_questionnaire_count + 1
    ),
    current_questionnaire_id: nextScaleId,
    questionnaires: plan.questionnaires.map(item =>
      item.id === scaleId ? { ...item, completed: true } : item
    )
  }
}

function previewTrainingContent() {
  void uni.navigateTo({
    url: '/pages/training/home-preview?preview=questionnaire'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A2"
    navigation-title="问卷"
    :title="title"
    :subtitle="subtitle"
  >
    <view v-if="isLoading" class="questionnaire-page__empty-state">
      正在加载问卷…
    </view>
    <view
      v-else-if="loadErrorMessage"
      class="questionnaire-page__empty-state questionnaire-page__empty-state--error"
      aria-live="polite"
    >
      <text>{{ loadErrorMessage }}</text>
      <button class="questionnaire-page__retry" type="button" @click="loadQuestionnaire">
        重新加载
      </button>
    </view>
    <view v-else-if="!questionnaire" class="questionnaire-page__empty-state">
      当前没有可提交的后端量表。
    </view>
    <view v-else class="questionnaire-page__handoff-stage">
      <view
        class="questionnaire-page__form-content"
        :class="{ 'questionnaire-page__form-content--held': confirmedSubmission }"
      >
        <view class="questionnaire-page__preview">
          <text>想先了解训练内容？</text>
          <button class="questionnaire-page__preview-action" type="button" @click="previewTrainingContent">
            先浏览小程序
          </button>
        </view>
        <view :key="questionnaireRunnerKey" class="questionnaire-page__form-stage">
          <LongQuestionnaireForm
            :questionnaire="questionnaire"
            :submitting="isSubmitting"
            :submit-label="submitLabel"
            :initial-answers="questionnaireDraft?.answers"
            :initial-question-index="questionnaireDraft?.currentQuestionIndex"
            :questionnaire-count="questionnaireCount"
            :questionnaire-number="questionnaireNumber"
            :estimated-minutes="estimatedMinutes"
            @draft-change="handleDraftChange"
            @reload="loadQuestionnaire"
            @submit="handleSubmit"
          />
        </view>
        <view v-if="submitErrorMessage" class="questionnaire-page__submit-error" aria-live="polite">
          <text>{{ submitErrorMessage }}</text>
        </view>
      </view>

      <view v-if="confirmedSubmission" class="questionnaire-page__handoff-layer" aria-live="polite">
        <view class="questionnaire-page__confirmed">
          <text class="questionnaire-page__confirmed-title">本份问卷已提交</text>
          <text v-if="isLoadingNextQuestionnaire">
            正在准备下一份问卷，请稍候。
          </text>
          <template v-else-if="nextQuestionnaireError">
            <text>{{ nextQuestionnaireError }}</text>
            <button
              class="questionnaire-page__next-retry"
              type="button"
              @click="loadNextQuestionnaire"
            >
              重新加载下一份
            </button>
          </template>
          <text v-else-if="isFinishingCheckpoint">
            正在打开问卷结果，请稍候。
          </text>
          <template v-else-if="checkpointCompletionError">
            <text>{{ checkpointCompletionError }}</text>
            <button
              class="questionnaire-page__next-retry"
              type="button"
              @click="finishCheckpoint(confirmedSubmission.result)"
            >
              重新打开结果
            </button>
          </template>
          <text v-else>答案已保存，正在继续。</text>
        </view>
      </view>
    </view>
  </UniAccessPageShell>
</template>

<style scoped>
.questionnaire-page__empty-state {
  padding: 36rpx 32rpx;
  border-radius: 32rpx;
  border: 6rpx dashed rgba(255, 211, 132, 0.28);
  background: rgba(255, 255, 255, 0.92);
  color: #64748B;
  font-size: 28rpx;
  font-weight: 700;
}

.questionnaire-page__empty-state--error,
.questionnaire-page__submit-error,
.questionnaire-page__confirmed {
  border-style: solid;
  border-width: 2rpx;
  border-color: rgba(199, 107, 91, 0.32);
  background: rgba(255, 232, 229, 0.72);
  color: #8f3f36;
}

.questionnaire-page__empty-state--error {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.questionnaire-page__retry {
  min-height: 108rpx;
  margin: 0;
  border: 0;
  border-radius: 999rpx;
  background: #FF8B8B;
  box-shadow: 0 8rpx 0 #DE7272;
  color: #1A202C;
  font-size: 34rpx;
  font-weight: 900;
}

.questionnaire-page__retry::after {
  border: none;
}

.questionnaire-page__submit-error {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.5;
}

.questionnaire-page__handoff-stage {
  position: relative;
}

.questionnaire-page__form-content {
  transition:
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.questionnaire-page__form-content--held {
  opacity: 0.42;
  transform: scale(0.992);
  pointer-events: none;
}

.questionnaire-page__handoff-layer {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 24rpx;
  box-sizing: border-box;
}

.questionnaire-page__confirmed {
  display: flex;
  width: 100%;
  max-width: 560rpx;
  flex-direction: column;
  gap: 20rpx;
  padding: 32rpx 28rpx;
  border-color: rgba(118, 174, 112, 0.36);
  background: rgba(223, 245, 218, 0.82);
  color: #286743;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.5;
  animation: questionnaire-page__state-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.questionnaire-page__form-stage {
  animation: questionnaire-page__state-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes questionnaire-page__state-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 12rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

.questionnaire-page__confirmed-title {
  color: #1f5135;
  font-size: 32rpx;
  font-weight: 900;
}

.questionnaire-page__next-retry {
  min-height: 96rpx;
  margin: 0;
  border: 0;
  border-radius: 999rpx;
  background: #FF8B8B;
  box-shadow: 0 8rpx 0 #DE7272;
  color: #1A202C;
  font-size: 30rpx;
  font-weight: 900;
}

.questionnaire-page__next-retry::after {
  border: none;
}

.questionnaire-page__preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
  color: #64748B;
  font-size: 23rpx;
  font-weight: 700;
}

.questionnaire-page__preview-action {
  min-height: 56rpx;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #C35F6B;
  font-size: 24rpx;
  font-weight: 900;
  text-decoration: underline;
}

.questionnaire-page__preview-action::after {
  border: none;
}
</style>
