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

onLoad((query) => {
  const nextQuery = query ?? {}
  checkpoint.value = normalizeCheckpoint(nextQuery.checkpoint?.toString())
  void loadQuestionnaire()
})

const checkpointLabel = computed(() => CHECKPOINT_LABELS[checkpoint.value])
const title = computed(() => questionnaire.value?.title ?? `${checkpointLabel.value} 长问卷`)
const subtitle = computed(() => questionnaire.value?.description || '完成本次评估后才能继续训练。')

onMounted(() => {
  if (hasLoaded.value) {
    return
  }

  void loadQuestionnaire()
})

async function loadQuestionnaire() {
  hasLoaded.value = true
  isLoading.value = true

  try {
    questionnaire.value = await studentBackendSync.loadLongQuestionnaire(checkpoint.value)
  } catch (error) {
    questionnaire.value = null
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
  try {
    const result = await studentBackendSync.syncLongQuestionnaire({
      checkpoint: checkpoint.value,
      ...payload
    })

    if (!result.synced || result.score === undefined || result.percentage === undefined || !result.submittedAt) {
      return
    }

    store.submitLongQuestionnaire(checkpoint.value, result.score, result.percentage)
    const queryString = buildMiniProgramQueryString({
      checkpoint: checkpoint.value,
      score: String(result.score),
      percentage: String(result.percentage),
      submittedAt: result.submittedAt
    })

    void uni.navigateTo({
      url: `/pages/access/questionnaire-result?${queryString}`
    })
  } catch (error) {
    reportBackendSyncError('问卷同步', error)
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
    <view v-else-if="!questionnaire" class="questionnaire-page__empty-state">
      当前没有可提交的后端量表。
    </view>
    <LongQuestionnaireForm
      v-else
      :questionnaire="questionnaire"
      @submit="handleSubmit"
    />
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
</style>
