<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import StationNotificationList from '../../../components/notifications/StationNotificationList.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStationNotifications } from '../../composables/useStationNotifications'

const stationNotifications = useStationNotifications()
const notifications = computed(() => stationNotifications.state.value.notifications)
const isRefreshing = ref(false)

onShow(() => {
  void stationNotifications.refresh()
})

async function handlePullDownRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await stationNotifications.refresh({ force: true })
  } finally {
    isRefreshing.value = false
  }
}
</script>

<template>
  <UniTrainingPageShell
    :show-dock="false"
    show-decorations
    page-title="训练提醒"
    show-back
    refresh-enabled
    :refreshing="isRefreshing"
    @refresh="handlePullDownRefresh"
  >
    <view class="notification-page">
      <view class="notification-page__heading">
        <UniPageHeading
          inset
          eyebrow="训练提醒"
          title="提醒中心"
          description="查看提醒，安排今天的训练与问卷。"
        />
        <button
          class="notification-page__read-all"
          data-notification-read-all
          :disabled="stationNotifications.isMarkingAllRead.value || stationNotifications.unreadCount.value === 0"
          @click="stationNotifications.markAllRead"
        >{{ stationNotifications.isMarkingAllRead.value ? '正在同步…' : '一键已读' }}</button>
      </view>
      <text v-if="stationNotifications.markAllReadError.value" class="notification-page__read-error">
        {{ stationNotifications.markAllReadError.value }}
      </text>

      <view v-if="stationNotifications.state.value.status === 'loading'" class="notification-page__status">
        <text>正在同步提醒…</text>
      </view>
      <view v-else-if="stationNotifications.state.value.status === 'error'" class="notification-page__status">
        <text>{{ stationNotifications.state.value.message }}</text>
        <button class="notification-page__retry" @click="stationNotifications.refresh({ force: true })">
          重新加载
        </button>
      </view>
      <StationNotificationList
        v-else
        :notifications="notifications"
        :has-more="stationNotifications.hasMore.value"
        :is-loading-more="stationNotifications.isLoadingMore.value"
        :load-more-error="stationNotifications.loadMoreError.value"
        @open="stationNotifications.open"
        @load-more="stationNotifications.loadMore"
      />
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.notification-page,
.notification-page__heading {
  display: flex;
  flex-direction: column;
}

.notification-page {
  gap: 36rpx;
  padding: 20rpx 32rpx 80rpx;
}

.notification-page__heading {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.notification-page__read-all {
  flex: none;
  margin: 24rpx 0 0;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #c76b5b;
  font-size: 24rpx;
  line-height: 1.5;
}

.notification-page__read-all::after { border: none; }
.notification-page__read-all[disabled] { color: #9ba4ae; }
.notification-page__read-error { color: #a14f4f; font-size: 24rpx; }

.notification-page__status {
  color: #7b8798;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.notification-page__status {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 20rpx;
  padding: 56rpx 24rpx;
  text-align: center;
}

.notification-page__retry {
  min-height: 64rpx;
  margin: 0;
  padding: 12rpx 28rpx;
  border-radius: 9999px;
  background: #203042;
  color: #fffaf6;
  font-size: 23rpx;
  line-height: 1.4;
  font-weight: 900;
}

.notification-page__retry::after {
  border: none;
}
</style>
