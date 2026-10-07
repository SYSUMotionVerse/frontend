<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import ReminderConsentCard from '../../../components/access/ReminderConsentCard.vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useReminderConsent } from '../../composables/useReminderConsent'

const consent = useReminderConsent()

onShow(() => { void consent.loadStatus() })

function enterTraining() {
  void uni.reLaunch({ url: '/pages/training/home' })
}

async function handleAuthorize() {
  if (consent.needsSettings.value) {
    await consent.openSettings()
    return
  }
  await consent.authorize()
  if (!consent.lastError.value && consent.syncState.value !== 'failed') {
    enterTraining()
  }
}

async function handleSkip() {
  await consent.decline()
  if (consent.syncState.value !== 'failed') {
    enterTraining()
  }
}

async function handleRetryFailure() {
  await consent.retryFailedOperation()
  if (consent.syncState.value === 'synced') {
    enterTraining()
  }
}
</script>

<template>
  <UniAccessPageShell
    chip="A4"
    navigation-title="训练提醒"
    title="训练提醒"
    subtitle="先了解提醒内容，再决定是否向微信申请授权。"
  >
    <ReminderConsentCard
      :status="consent.status.value"
      :sync-state="consent.syncState.value"
      :failed-operation="consent.failedOperation.value"
      :is-working="consent.isWorking.value"
      :needs-settings="consent.needsSettings?.value"
      :error-message="consent.lastError?.value"
      @authorize="handleAuthorize"
      @skip="handleSkip"
      @retry-failure="handleRetryFailure"
      @continue="enterTraining"
    />
  </UniAccessPageShell>
</template>
