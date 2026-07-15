<script setup lang="ts">
import ReminderConsentCard from '../../../components/access/ReminderConsentCard.vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useReminderConsent } from '../../composables/useReminderConsent'

const consent = useReminderConsent()

function enterTraining() {
  void uni.reLaunch({ url: '/pages/training/home' })
}

async function handleAuthorize() {
  await consent.authorize()
  enterTraining()
}

async function handleSkip() {
  await consent.decline()
  enterTraining()
}
</script>

<template>
  <UniAccessPageShell
    chip="A4"
    title="训练提醒"
    subtitle="先了解提醒内容，再决定是否向微信申请授权。"
  >
    <ReminderConsentCard
      :status="consent.status.value"
      :sync-state="consent.syncState.value"
      :is-working="consent.isWorking.value"
      @authorize="handleAuthorize"
      @skip="handleSkip"
    />
  </UniAccessPageShell>
</template>
