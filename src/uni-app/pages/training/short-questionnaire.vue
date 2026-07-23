<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ShortQuestionnaireForm from '../../../components/training/ShortQuestionnaireForm.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { studentBackendSync } from '../../api/studentBackend'

const store = useStudentStore()
const latestResponse = shallowRef<{ energyLevel: number; confidence: number; enjoyment: number } | null>(null)
const isSubmitting = shallowRef(false)
const statusMessage = shallowRef('')
const routeSessionId = shallowRef('')
const activeSessionId = computed(() => {
  if (routeSessionId.value) {
    return routeSessionId.value
  }
  return store.getSnapshot().sessions.at(-1)?.id ?? ''
})

onLoad((query) => {
  routeSessionId.value = query?.sessionId?.toString() ?? ''
})

onMounted(() => {
  void studentBackendSync.retryPendingShortQuestionnaires()
})

async function submitResponse(payload: { energyLevel: number; confidence: number; enjoyment: number }) {
  if (isSubmitting.value) {
    return
  }

  if (!activeSessionId.value) {
    statusMessage.value = '未找到本次训练记录，请返回首页后重试。'
    return
  }

  isSubmitting.value = true
  latestResponse.value = payload
  let result: Awaited<ReturnType<typeof studentBackendSync.syncShortQuestionnaire>>
  try {
    result = await studentBackendSync.syncShortQuestionnaire({
      sessionId: activeSessionId.value,
      ...payload
    })
  } catch {
    // The durable save itself may have failed (quota/storage or validation).
    // Do not claim the data was safely stored — give a truthful retry message.
    statusMessage.value = '反馈保存失败，请重试。'
    return
  } finally {
    isSubmitting.value = false
  }

  store.submitShortQuestionnaireForLatestSession(payload)
  if (!result.synced) {
    statusMessage.value = result.reason === 'network-error'
      ? '反馈已安全保存在本机，网络恢复后将自动重试。请返回首页继续使用。'
      : '反馈已安全保存在本机，待后端开放接口后再同步。请返回首页继续使用。'
    return
  }

  void uni.redirectTo({
    url: `/pages/training/feedback?sessionId=${encodeURIComponent(activeSessionId.value)}`
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
    <ShortQuestionnaireForm :submitting="isSubmitting" @submit="submitResponse" />

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
