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
import type { PsychologyQuestionnaireModel } from '../../api/studentBackendTypes'

const store = useStudentStore()
const checkpoint = ref<CheckpointKey>('baseline')
const questionnaire = shallowRef<PsychologyQuestionnaireModel | null>(null)
const isLoading = shallowRef(true)
const hasLoaded = shallowRef(false)
const isSubmitting = shallowRef(false)
const loadErrorMessage = shallowRef('')
const submitErrorMessage = shallowRef('')

onLoad((query) => {
  const nextQuery = query ?? {}
  checkpoint.value = normalizeCheckpoint(nextQuery.checkpoint?.toString())
  void loadQuestionnaire()
})

const checkpointLabel = computed(() => CHECKPOINT_LABELS[checkpoint.value])
const title = computed(() => questionnaire.value?.title ?? `${checkpointLabel.value} 长问卷`)
const subtitle = computed(() => questionnaire.value?.description || '完成本次评估后才能继续训练。')
const submitLabel = computed(() => submitErrorMessage.value ? '重新提交答案' : '提交答案')

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
    questionnaire.value = await studentBackendSync.loadLongQuestionnaire(checkpoint.value)
  } catch (error) {
    questionnaire.value = null
    loadErrorMessage.value = '问卷加载失败，请检查网络后重试。'
    reportBackendSyncError('问卷加载', error)
  } finally {
    isLoading.value = false
  }
}

async function handleSubmit(payload: {
  scaleId: number
  answers: Record<number, number>
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

    store.submitLongQuestionnaire(checkpoint.value, result.score, result.percentage)
    const queryString = buildMiniProgramQueryString({
      checkpoint: checkpoint.value,
      score: String(result.score),
      percentage: String(result.percentage),
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
</script>

<template>
  <UniAccessPageShell
    chip="A2"
    :title="title"
    :subtitle="subtitle"
  >
    <view v-if="isLoading" class="questionnaire-page__empty-state">
      正在加载问卷...
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
      <LongQuestionnaireForm
        :questionnaire="questionnaire"
        :submitting="isSubmitting"
        :submit-label="submitLabel"
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
  min-height: 88rpx;
  margin: 0;
  border-radius: 9999px;
  background: #203042;
  color: #fffaf4;
  font-size: 26rpx;
  font-weight: 800;
}

.questionnaire-page__submit-error {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.5;
}
</style>
