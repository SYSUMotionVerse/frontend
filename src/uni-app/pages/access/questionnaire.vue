<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
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
import { buildMiniProgramQueryString } from '../../platform/queryString'
import {
  questionnaireDraftStorage,
  type QuestionnaireDraft
} from '../../platform/questionnaireDraftStorage'
import type {
  BackendQuestionnairePlan,
  PsychologyQuestionnaireAnswer,
  PsychologyQuestionnaireModel
} from '../../api/studentBackendTypes'

const store = useStudentStore()
const checkpoint = ref<CheckpointKey>('baseline')
const questionnaire = shallowRef<PsychologyQuestionnaireModel | null>(null)
const isLoading = shallowRef(true)
const hasLoaded = shallowRef(false)
const isSubmitting = shallowRef(false)
const loadErrorMessage = shallowRef('')
const submitErrorMessage = shallowRef('')
const questionnaireDraft = shallowRef<QuestionnaireDraft | null>(null)
const questionnairePlan = shallowRef<BackendQuestionnairePlan | null>(null)
const draftStudentId = computed(() => String(store.state.profile?.studentId ?? '').trim())

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

async function loadQuestionnaire() {
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
  try {
    const result = await studentBackendSync.syncLongQuestionnaire({
      checkpoint: checkpoint.value,
      ...payload
    })

    if (!result.synced || result.score === undefined || result.percentage === undefined || !result.submittedAt) {
      submitErrorMessage.value = '问卷提交失败，请检查网络后重新提交。'
      return
    }

    questionnaireDraftStorage.clear(draftStudentId.value, checkpoint.value, payload.scaleId)
    questionnaireDraft.value = null
    if (typeof studentBackendSync.loadQuestionnairePlan === 'function') {
      const [nextQuestionnaire, nextPlan] = await Promise.all([
        studentBackendSync.loadLongQuestionnaire(checkpoint.value),
        studentBackendSync.loadQuestionnairePlan(checkpoint.value)
      ])
      questionnairePlan.value = nextPlan
      if (nextQuestionnaire) {
        questionnaire.value = nextQuestionnaire
        questionnaireDraft.value = draftStudentId.value
          ? questionnaireDraftStorage.load(
              draftStudentId.value,
              checkpoint.value,
              nextQuestionnaire.scaleId
            )
          : null
        void uni.showToast({
          title: '本份已保存，继续下一份',
          icon: 'none'
        })
        return
      }
    }

    store.submitLongQuestionnaire(checkpoint.value, 0, 100)
    const queryString = buildMiniProgramQueryString({
      checkpoint: checkpoint.value,
      score: '0',
      percentage: '100',
      questionnaireCount: String(questionnairePlan.value?.questionnaire_count ?? 1),
      submittedAt: result.submittedAt
    })

    void uni.redirectTo({
      url: `/pages/access/questionnaire-result?${queryString}`
    })
  } catch (error) {
    reportBackendSyncError('问卷同步', error)
    submitErrorMessage.value = '问卷提交失败，请检查网络后重新提交。'
  } finally {
    isSubmitting.value = false
  }
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
  questionnaireDraftStorage.save(draft)
  questionnaireDraft.value = draft
}

function previewTrainingContent() {
  void uni.navigateTo({
    url: '/pages/training/home?preview=questionnaire'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A2"
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
    <template v-else>
      <view class="questionnaire-page__preview">
        <text>想先了解训练内容？</text>
        <button class="questionnaire-page__preview-action" type="button" @click="previewTrainingContent">
          先浏览小程序
        </button>
      </view>
      <LongQuestionnaireForm
        :key="questionnaire.scaleId"
        :questionnaire="questionnaire"
        :submitting="isSubmitting"
        :submit-label="submitLabel"
        :initial-answers="questionnaireDraft?.answers"
        :initial-question-index="questionnaireDraft?.currentQuestionIndex"
        :questionnaire-count="questionnaireCount"
        :questionnaire-number="questionnaireNumber"
        :estimated-minutes="estimatedMinutes"
        @draft-change="handleDraftChange"
        @submit="handleSubmit"
      />
      <view v-if="submitErrorMessage" class="questionnaire-page__submit-error" aria-live="polite">
        <text>{{ submitErrorMessage }}</text>
      </view>
    </template>
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
.questionnaire-page__submit-error {
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
