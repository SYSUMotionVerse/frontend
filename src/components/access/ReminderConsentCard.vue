<script setup lang="ts">
import { computed } from 'vue'
import { REMINDER_AUTHORIZATION_PRESENTATION } from '../../features/training/reminderAuthorization'
import type {
  ReminderAuthorizationStatus,
  ReminderFailedOperation,
  ReminderSyncState
} from '../../uni-app/platform/reminderConsent'

const props = defineProps<{
  status: ReminderAuthorizationStatus
  syncState: ReminderSyncState
  failedOperation: ReminderFailedOperation
  isWorking: boolean
}>()

const emit = defineEmits<{
  authorize: []
  skip: []
  retryFailure: []
  continue: []
}>()

const isSyncFailed = computed(() => props.syncState === 'failed')
const statusMessage = computed(() => {
  if (isSyncFailed.value) {
    return props.failedOperation === 'load_config'
      ? '暂时无法获取提醒配置，尚未调用微信授权；当前状态保持不变。'
      : '授权结果暂未同步，但不影响进入训练。'
  }
  return REMINDER_AUTHORIZATION_PRESENTATION[props.status].consentMessage
})
</script>

<template>
  <view class="reminder-consent bg-white chunky-shadow">
    <view class="reminder-consent__icon" aria-hidden="true">
      ⏰
    </view>
    <text class="reminder-consent__title">训练提醒由你确认</text>
    <text class="reminder-consent__copy">
      在每天 12:00 和 18:00，我们会根据今日训练进度发送提醒。消息只包含完成进度和待完成项目，不包含评分或健康数据。
    </text>
    <view class="reminder-consent__facts">
      <text class="reminder-consent__fact">授权由微信管理，你可以拒绝</text>
      <text class="reminder-consent__fact">无论是否授权，都能进入训练</text>
    </view>
    <text v-if="statusMessage" class="reminder-consent__status">{{ statusMessage }}</text>
    <template v-if="isSyncFailed">
      <button
        class="reminder-consent__primary reminder-consent__retry-sync"
        :disabled="props.isWorking"
        @click="emit('retryFailure')"
      >
        {{ props.failedOperation === 'load_config' ? '重新获取配置并授权' : '重新同步授权结果' }}
      </button>
      <button class="reminder-consent__secondary reminder-consent__continue" @click="emit('continue')">
        暂不同步，进入训练
      </button>
    </template>
    <template v-else>
      <button
        class="reminder-consent__primary"
        :disabled="props.isWorking"
        @click="emit('authorize')"
      >
        {{ props.isWorking ? '正在请求...' : '开启微信训练提醒' }}
      </button>
      <button class="reminder-consent__secondary" @click="emit('skip')">
        暂不开启，进入训练
      </button>
    </template>
  </view>
</template>

<style scoped>
.reminder-consent {
  padding: 44rpx 36rpx 36rpx;
  border-radius: 32rpx;
  color: #152033;
}

.reminder-consent__icon {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28rpx;
  background: #fff2bd;
  font-size: 48rpx;
}

.reminder-consent__title,
.reminder-consent__copy,
.reminder-consent__status,
.reminder-consent__fact {
  display: block;
}

.reminder-consent__title {
  margin-top: 28rpx;
  font-size: 42rpx;
  font-weight: 900;
}

.reminder-consent__copy {
  margin-top: 20rpx;
  color: #536176;
  font-size: 28rpx;
  line-height: 1.7;
}

.reminder-consent__facts {
  margin: 28rpx 0;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #f5f7fb;
  color: #344258;
  font-size: 26rpx;
  line-height: 1.8;
}

.reminder-consent__status {
  margin-bottom: 20rpx;
  color: #805e13;
  font-size: 25rpx;
  line-height: 1.5;
}

.reminder-consent__primary,
.reminder-consent__secondary {
  width: 100%;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.reminder-consent__primary {
  background: #f7c948;
  color: #152033;
}

.reminder-consent__secondary {
  margin-top: 16rpx;
  background: transparent;
  color: #536176;
}
</style>
