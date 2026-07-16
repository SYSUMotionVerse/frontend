<script setup lang="ts">
import type { StationNotificationViewModel } from '../../uni-app/api/stationNotificationModels'

const props = defineProps<{
  notifications: readonly StationNotificationViewModel[]
}>()

const emit = defineEmits<{
  open: [notification: StationNotificationViewModel]
}>()
</script>

<template>
  <view v-if="props.notifications.length" class="notification-list">
    <button
      v-for="notification in props.notifications"
      :key="notification.id"
      class="notification-row"
      :class="{ 'notification-row--unread': !notification.isRead }"
      :data-notification-id="notification.id"
      @click="emit('open', notification)"
    >
      <view class="notification-row__topline">
        <text class="notification-row__title">{{ notification.title }}</text>
        <text v-if="notification.slot" class="notification-row__slot">
          {{ notification.slot }}
        </text>
      </view>
      <text class="notification-row__content">{{ notification.content }}</text>
      <view class="notification-row__footer">
        <text>{{ notification.createdAtLabel }}</text>
        <text class="notification-row__action">查看今日训练</text>
      </view>
      <text v-if="notification.readSyncFailed" class="notification-row__sync-error">
        未读状态同步失败，点击可重试
      </text>
    </button>
  </view>
  <view v-else class="notification-empty">
    <text class="notification-empty__title">还没有训练提醒</text>
    <text class="notification-empty__copy">完成当天训练后，这里会保持安静。</text>
  </view>
</template>

<style scoped>
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.notification-row {
  display: flex;
  width: 100%;
  margin: 0;
  flex-direction: column;
  gap: 18rpx;
  padding: 30rpx;
  border: 2rpx solid rgba(123, 135, 152, 0.14);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  color: #203042;
  text-align: left;
  box-shadow: 0 10rpx 0 rgba(231, 219, 202, 0.54);
}

.notification-row::after {
  border: none;
}

.notification-row--unread {
  border-color: rgba(255, 139, 139, 0.42);
  background: rgba(255, 250, 246, 0.98);
}

.notification-row__topline,
.notification-row__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.notification-row__title {
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 900;
}

.notification-row__slot {
  flex: none;
  padding: 6rpx 14rpx;
  border-radius: 9999px;
  background: rgba(255, 236, 199, 0.46);
  color: #a87313;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 900;
}

.notification-row__content {
  color: #5f6f82;
  font-size: 25rpx;
  line-height: 1.55;
  font-weight: 700;
}

.notification-row__footer {
  color: #909bab;
  font-size: 20rpx;
  line-height: 1.3;
}

.notification-row__action {
  color: #e37373;
  font-weight: 900;
}

.notification-row__sync-error {
  color: #a14f4f;
  font-size: 21rpx;
  line-height: 1.4;
  font-weight: 800;
}

.notification-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12rpx;
  padding: 80rpx 32rpx;
  color: #7b8798;
  text-align: center;
}

.notification-empty__title {
  color: #203042;
  font-size: 34rpx;
  font-weight: 900;
}

.notification-empty__copy {
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}
</style>
