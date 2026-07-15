<script setup lang="ts">
import { computed } from 'vue'
import { REMINDER_AUTHORIZATION_PRESENTATION } from '../../features/training/reminderAuthorization'
import type {
  ReminderAuthorizationStatus,
  ReminderSyncState
} from '../../uni-app/platform/reminderConsent'

const props = defineProps<{
  status: ReminderAuthorizationStatus
  syncState: ReminderSyncState
  isWorking: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const presentation = computed(() => REMINDER_AUTHORIZATION_PRESENTATION[props.status])
const title = computed(() => presentation.value.homeTitle)

const detail = computed(() => {
  if (props.syncState === 'failed') {
    return '状态同步失败，不影响训练。可再次尝试授权并同步。'
  }
  return presentation.value.homeDetail
})

const canRetry = computed(() => presentation.value.canRetryAuthorization)
</script>

<template>
  <view class="reminder-authorization-status">
    <view class="reminder-authorization-status__copy">
      <text class="reminder-authorization-status__title">{{ title }}</text>
      <text class="reminder-authorization-status__detail">{{ detail }}</text>
    </view>
    <button
      v-if="canRetry"
      class="reminder-authorization-status__action"
      :disabled="props.isWorking"
      @click="emit('retry')"
    >
      {{ props.isWorking ? '请求中...' : '重新授权' }}
    </button>
  </view>
</template>

<style scoped>
.reminder-authorization-status {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin: 0 32rpx 32rpx;
  padding: 28rpx;
  border: 2rpx solid #e4dfd3;
  border-radius: 28rpx;
  background: #fffdf8;
}

.reminder-authorization-status__copy {
  flex: 1;
  min-width: 0;
}

.reminder-authorization-status__title,
.reminder-authorization-status__detail {
  display: block;
}

.reminder-authorization-status__title {
  color: #152033;
  font-size: 28rpx;
  font-weight: 900;
}

.reminder-authorization-status__detail {
  margin-top: 8rpx;
  color: #667085;
  font-size: 23rpx;
  line-height: 1.5;
}

.reminder-authorization-status__action {
  flex: none;
  min-width: 156rpx;
  margin: 0;
  border-radius: 999rpx;
  background: #f7c948;
  color: #152033;
  font-size: 24rpx;
  font-weight: 800;
}
</style>
