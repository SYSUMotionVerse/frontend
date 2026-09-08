<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ShortQuestionnaireForm from '../../../components/training/ShortQuestionnaireForm.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import { isTrainingMockEnabled } from '../../../features/training/trainingMock'

type SubmissionStatus = 'idle' | 'error' | 'saved-locally' | 'submitted'
type StatusAction = 'retry' | 'home' | 'feedback'
type ShortQuestionnaireResponse = {
  feelingScale: number
  feltArousalScale: number
}

const store = useStudentStore()
const mockEnabled = isTrainingMockEnabled()
const isSubmitting = shallowRef(false)
const submissionStatus = shallowRef<SubmissionStatus>('idle')
const submissionMessage = shallowRef('')
const submissionAction = shallowRef<StatusAction>('retry')
const routeSessionId = shallowRef('')
const mockSession = shallowRef(false)
const mockModality = shallowRef<'wushu' | 'hiit'>('wushu')
const feedbackNavigationTimeoutMs = 5_000
let isOpeningFeedback = false
const activeSessionId = computed(() => {
  if (routeSessionId.value) {
    return routeSessionId.value
  }
  return store.getSnapshot().sessions.at(-1)?.id ?? ''
})

onLoad((query) => {
  routeSessionId.value = query?.sessionId?.toString() ?? ''
  mockSession.value = mockEnabled && query?.mock?.toString() === '1'
  mockModality.value = query?.modality?.toString() === 'hiit' ? 'hiit' : 'wushu'
})

onMounted(() => {
  void studentBackendSync.retryPendingShortQuestionnaires()
})

function setSubmissionStatus(
  status: SubmissionStatus,
  message = '',
  action: StatusAction = 'retry'
) {
  submissionStatus.value = status
  submissionMessage.value = message
  submissionAction.value = action
}

async function submitResponse(payload: ShortQuestionnaireResponse) {
  if (
    isSubmitting.value
    || submissionStatus.value === 'submitted'
    || submissionAction.value === 'feedback'
  ) {
    return
  }

  if (!activeSessionId.value) {
    setSubmissionStatus(
      'error',
      '未找到本次训练记录，请返回训练首页后重试。',
      'home'
    )
    return
  }

  setSubmissionStatus('idle')
  isSubmitting.value = true
  if (mockSession.value) {
    store.submitShortQuestionnaireForSession(activeSessionId.value, payload)
    const sessionId = activeSessionId.value
    setSubmissionStatus('submitted', '', 'feedback')
    await openFeedback(sessionId)
    isSubmitting.value = false
    return
  }

  let result: Awaited<ReturnType<typeof studentBackendSync.syncShortQuestionnaire>>
  try {
    result = await studentBackendSync.syncShortQuestionnaire({
      sessionId: activeSessionId.value,
      ...payload
    })
  } catch {
    // The durable save itself may have failed (quota/storage or validation).
    // Do not claim the data was safely stored — give a truthful retry message.
    setSubmissionStatus('error', '反馈保存失败，请重试提交。')
    isSubmitting.value = false
    return
  }

  store.submitShortQuestionnaireForSession(activeSessionId.value, payload)
  if (!result.synced) {
    setSubmissionStatus(
      'saved-locally',
      result.reason === 'network-error'
        ? '反馈已安全保存在本机，网络恢复后将自动重试。'
        : '反馈已安全保存在本机，待后端开放接口后再同步。',
      'home'
    )
    isSubmitting.value = false
    return
  }

  const sessionId = activeSessionId.value
  setSubmissionStatus('submitted', '', 'feedback')
  await openFeedback(sessionId)
  isSubmitting.value = false
}

async function openFeedback(sessionId = activeSessionId.value) {
  if (isOpeningFeedback || !sessionId) {
    return
  }

  isOpeningFeedback = true
  try {
    await redirectToFeedback(sessionId)
  } catch (error) {
    reportBackendSyncError('训练反馈跳转', error)
    setSubmissionStatus(
      'error',
      '反馈已保存，但训练反馈页暂时无法打开。请重新打开。',
      'feedback'
    )
  } finally {
    isOpeningFeedback = false
  }
}

function redirectToFeedback(sessionId: string) {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      settle(() => reject(new Error('Training feedback navigation timed out.')))
    }, feedbackNavigationTimeoutMs)

    function settle(action: () => void) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      action()
    }

    try {
      const mockQuery = mockSession.value
        ? `&mock=1&modality=${mockModality.value}`
        : ''
      Promise.resolve(uni.redirectTo({
        url: `/pages/training/feedback?sessionId=${encodeURIComponent(sessionId)}${mockQuery}`
      })).then(
        () => settle(resolve),
        error => settle(() => reject(error))
      )
    } catch (error) {
      settle(() => reject(error))
    }
  })
}

function goHome() {
  void uni.switchTab({
    url: '/pages/training/home'
  })
}
</script>

<template>
  <UniTrainingPageShell :show-dock="false" page-title="简短问卷" show-navigation scroll-content show-back show-decorations>
    <view class="short-questionnaire-page">
      <ShortQuestionnaireForm
        :submitting="isSubmitting"
        :status="submissionStatus"
        :status-message="submissionMessage"
        :status-action="submissionAction"
        @submit="submitResponse"
        @open-feedback="openFeedback"
        @go-home="goHome"
      />
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.short-questionnaire-page {
  display: flex;
  width: 100%;
  min-height: 100%;
  flex: 1;
  flex-direction: column;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
}

@media (max-height: 640px) {
  .short-questionnaire-page {
    padding-top: 20rpx;
    padding-bottom: 32rpx;
  }
}
</style>
