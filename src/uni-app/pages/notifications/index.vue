<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import StationNotificationList from '../../../components/notifications/StationNotificationList.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStationNotifications } from '../../composables/useStationNotifications'

const stationNotifications = useStationNotifications()
const notifications = computed(() => stationNotifications.state.value.notifications)

onShow(() => {
  void stationNotifications.refresh()
})
</script>

<template>
  <UniTrainingPageShell
    :show-dock="false"
    show-decorations
    page-title="训练提醒"
    show-back
  >
    <view class="notification-page">
      <UniPageHeading
        eyebrow="训练提醒"
        title="提醒中心"
        description="查看午间和晚间提醒，安排今天的训练。"
      />

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
