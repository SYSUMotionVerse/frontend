<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import ShortQuestionnaireForm from '../../../components/training/ShortQuestionnaireForm.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { studentBackendSync } from '../../api/studentBackend'

const store = useStudentStore()
const latestResponse = shallowRef<{ energyLevel: number; confidence: number; enjoyment: number } | null>(null)
const isSubmitting = shallowRef(false)
const statusMessage = shallowRef('')
const latestSessionId = computed(() => store.getSnapshot().sessions.at(-1)?.id ?? '')

async function submitResponse(payload: { energyLevel: number; confidence: number; enjoyment: number }) {
  if (isSubmitting.value) {
    return
  }

  if (!latestSessionId.value) {
    statusMessage.value = '未找到本次训练记录，请返回首页后重试。'
    return
  }

  isSubmitting.value = true
  latestResponse.value = payload
  let result: Awaited<ReturnType<typeof studentBackendSync.syncShortQuestionnaire>>
  try {
    result = await studentBackendSync.syncShortQuestionnaire({
      sessionId: latestSessionId.value,
      ...payload
    })
  } catch {
    store.submitShortQuestionnaireForLatestSession(payload)
    statusMessage.value = '反馈已安全保存在本机，但暂未同步。请返回首页继续使用。'
    return
  } finally {
    isSubmitting.value = false
  }

  store.submitShortQuestionnaireForLatestSession(payload)
  if (!result.synced) {
    statusMessage.value = '反馈已安全保存在本机，待后端开放接口后再同步。请返回首页继续使用。'
    return
  }

  void uni.redirectTo({
    url: `/pages/training/feedback?sessionId=${encodeURIComponent(latestSessionId.value)}`
  })
}

function goHome() {
  void uni.redirectTo({
    url: '/pages/training/home'
  })
}
</script>

<template>
  <UniTrainingPageShell :show-dock="false">
    <ShortQuestionnaireForm @submit="submitResponse" />

    <section v-if="statusMessage" class="card-shell p-18 text-14 text-slate-600">
      {{ statusMessage }}
      <button class="btn-primary mt-16" type="button" @click="goHome">
        返回首页
      </button>
    </section>

    <section v-if="latestResponse" class="card-shell p-18 text-14 text-slate-600">
      上次反馈：精力 {{ latestResponse.energyLevel }}，信心 {{ latestResponse.confidence }}，愉悦度 {{ latestResponse.enjoyment }}
    </section>
  </UniTrainingPageShell>
</template>
