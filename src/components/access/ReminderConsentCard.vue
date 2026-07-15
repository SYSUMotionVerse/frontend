<script setup lang="ts">
import { computed } from 'vue'
import type { ReminderAuthorizationStatus } from '../../uni-app/platform/reminderConsent'

const props = defineProps<{
  status: ReminderAuthorizationStatus
  syncState: 'idle' | 'syncing' | 'synced' | 'failed'
  isWorking: boolean
}>()

const emit = defineEmits<{
  authorize: []
  skip: []
}>()

const statusMessage = computed(() => {
  if (props.syncState === 'failed') {
    return '授权结果暂未同步，但不影响进入训练。'
  }
  if (props.status === 'unconfigured') {
    return '长期订阅模板尚未配置，当前仅记录你的选择。'
  }
  if (props.status === 'unsupported') {
    return '当前环境不支持微信订阅授权，你仍可正常训练。'
  }
  if (props.status === 'banned') {
    return '微信中已禁止该类消息，可稍后在训练首页查看状态。'
  }
  return ''
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
      <text>授权由微信管理，你可以拒绝</text>
      <text>无论是否授权，都能进入训练</text>
    </view>
    <text v-if="statusMessage" class="reminder-consent__status">{{ statusMessage }}</text>
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
.reminder-consent__facts text {
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
