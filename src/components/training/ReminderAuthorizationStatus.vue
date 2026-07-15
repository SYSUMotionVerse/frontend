<script setup lang="ts">
import { computed } from 'vue'
import type { ReminderAuthorizationStatus } from '../../uni-app/platform/reminderConsent'

const props = defineProps<{
  status: ReminderAuthorizationStatus
  syncState: 'idle' | 'syncing' | 'synced' | 'failed'
  isWorking: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const title = computed(() => {
  if (props.status === 'accepted') {
    return '微信提醒已开启'
  }
  if (props.status === 'not_requested') {
    return '微信提醒尚未确认'
  }
  return '未开启微信提醒'
})

const detail = computed(() => {
  if (props.syncState === 'failed') {
    return '状态同步失败，不影响训练。可再次尝试授权并同步。'
  }
  if (props.status === 'accepted') {
    return '符合条件时，我们会在 12:00 和 18:00 发送训练进度提醒。'
  }
  if (props.status === 'unconfigured') {
    return '长期订阅模板尚未配置，当前不会发送微信消息。'
  }
  if (props.status === 'unsupported') {
    return '当前平台不支持微信授权，可在微信小程序中重试。'
  }
  if (props.status === 'banned') {
    return '微信已禁止该类消息，可调整微信设置后重试。'
  }
  return '你仍可正常训练，需要时可主动再次授权。'
})

const canRetry = computed(() => props.status !== 'accepted')
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
