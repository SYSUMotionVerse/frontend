<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed } from 'vue'
import { DEFAULT_AVATAR_URL } from '../../constants/defaultAvatar'
import type {
  ReminderAuthorizationStatus,
  ReminderSyncState
} from '../../uni-app/platform/reminderConsent'

const props = withDefaults(defineProps<{
  displayName: string
  reminderLabel: string
  miniTag?: string
  title?: string
  titlePill?: string
  variant?: 'home' | 'compact'
  miniTagTone?: 'accent' | 'muted'
  unreadCount?: number
  showHeadline?: boolean
  showStatus?: boolean
  showReminderControl?: boolean
  reminderStatus?: ReminderAuthorizationStatus
  reminderSyncState?: ReminderSyncState
  reminderWorking?: boolean
}>(), {
  miniTag: "TODAY'S QUEST",
  title: '今天先完成主线任务',
  titlePill: '训练首页',
  variant: 'home',
  miniTagTone: 'accent',
  unreadCount: 0,
  showHeadline: true,
  showStatus: true,
  showReminderControl: false,
  reminderStatus: 'not_requested',
  reminderSyncState: 'idle',
  reminderWorking: false
})

const emit = defineEmits<{
  openNotifications: []
  authorizeReminders: []
}>()
const headerClasses = computed(() => ['home-header', `home-header--${props.variant}`])
const reminderActionLabel = computed(() => {
  if (!props.showReminderControl) return null
  if (props.reminderWorking) return '请求中'
  if (props.reminderSyncState === 'failed') return '重试提醒'
  if (['not_requested', 'rejected', 'banned', 'unsupported'].includes(props.reminderStatus)) {
    return '开提醒'
  }
  return null
})
</script>

<template>
  <view :class="headerClasses">
    <view class="home-header__topbar">
      <view class="home-header__profile">
        <view class="home-header__avatar-shell" aria-label="默认用户头像">
          <image class="home-header__avatar" :src="DEFAULT_AVATAR_URL" mode="aspectFit" />
        </view>

        <view class="home-header__copy">
          <text class="home-header__name">你好，{{ props.displayName }}</text>
          <text
            class="home-header__mini-tag"
            :class="{ 'home-header__mini-tag--muted': props.miniTagTone === 'muted' }"
          >{{ props.miniTag }}</text>
        </view>
      </view>

      <view class="home-header__notification">
        <button
          class="home-header__bell-shell"
          aria-label="查看训练提醒"
          @click="emit('openNotifications')"
        >
          <text v-if="props.unreadCount > 0" class="home-header__bell-badge">
            {{ props.unreadCount > 99 ? '99+' : props.unreadCount }}
          </text>
          <uni-icons type="notification-filled" size="25" color="#ff8c93" />
        </button>
        <button
          v-if="reminderActionLabel"
          class="home-header__reminder-action"
          :disabled="props.reminderWorking"
          @click="emit('authorizeReminders')"
        >
          <text class="home-header__reminder-action-dot" />
          <text>{{ reminderActionLabel }}</text>
        </button>
      </view>
    </view>

    <text v-if="props.showStatus" class="home-header__status">{{ props.reminderLabel }}</text>

    <view v-if="props.showHeadline" class="home-header__headline">
      <text class="home-header__hint-pill">{{ props.titlePill }}</text>
      <text class="home-header__title">{{ props.title }}</text>
    </view>

  </view>
</template>

<style scoped>
.home-header {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.home-header--compact {
  gap: 12rpx;
}

.home-header__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding-top: 8rpx;
}

.home-header--compact .home-header__topbar {
  gap: 18rpx;
  padding-top: 0;
}

.home-header__profile {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 18rpx;
}

.home-header__notification {
  position: relative;
  display: flex;
  width: 88rpx;
  height: 88rpx;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.home-header--compact .home-header__profile {
  gap: 16rpx;
}

.home-header__avatar-shell {
  position: relative;
  display: inline-flex;
  width: 88rpx;
  height: 88rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  padding: 8rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14rpx 24rpx rgba(37, 47, 61, 0.06);
}

.home-header--compact .home-header__avatar-shell {
  width: 76rpx;
  height: 76rpx;
  padding: 7rpx;
}

.home-header__avatar {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: #ffd8a3;
}

.home-header__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4rpx;
}

.home-header--compact .home-header__copy {
  gap: 2rpx;
}

.home-header__name {
  display: block;
  color: #203042;
  font-size: 36rpx;
  line-height: 1.18;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.home-header--compact .home-header__name {
  font-size: 34rpx;
}

.home-header__mini-tag {
  display: block;
  color: #ff8b8b;
  font-size: 16rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.home-header__mini-tag--muted {
  color: #718096;
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 0;
}

.home-header--compact .home-header__mini-tag {
  font-size: 16rpx;
  letter-spacing: 0.12em;
}

.home-header__bell-shell {
  position: relative;
  display: inline-flex;
  width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 14rpx 24rpx rgba(37, 47, 61, 0.06),
    0 6rpx 0 rgba(231, 219, 202, 0.72);
}

.home-header__bell-shell::after {
  border: none;
}

.home-header--compact .home-header__bell-shell {
  width: 76rpx;
  height: 76rpx;
}

.home-header__bell-badge {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  min-width: 28rpx;
  min-height: 28rpx;
  padding: 2rpx 7rpx;
  border-radius: 9999px;
  background: #ff8b8b;
  color: #fffaf6;
  font-size: 16rpx;
  line-height: 1.4;
  font-weight: 900;
  text-align: center;
}

.home-header--compact .home-header__bell-badge {
  top: 16rpx;
  right: 16rpx;
}

.home-header__reminder-action {
  position: absolute;
  top: 94rpx;
  right: 0;
  z-index: 2;
  display: inline-flex;
  min-height: 34rpx;
  margin: -2rpx 0 0;
  padding: 0 10rpx;
  align-items: center;
  gap: 6rpx;
  border: 0;
  border-radius: 9999px;
  background: rgba(255, 236, 199, 0.72);
  color: #b17c24;
  font-size: 16rpx;
  line-height: 1.2;
  font-weight: 900;
  white-space: nowrap;
}

.home-header__reminder-action::after {
  border: none;
}

.home-header__reminder-action:disabled {
  opacity: 0.66;
}

.home-header__reminder-action-dot {
  display: block;
  width: 10rpx;
  height: 10rpx;
  border-radius: 9999px;
  background: #ff9d82;
}

.home-header__status {
  display: block;
  margin-top: -16rpx;
  color: #9b896e;
  font-size: 18rpx;
  line-height: 1.4;
  font-weight: 800;
  text-align: right;
}

.home-header--compact .home-header__status {
  margin-top: -12rpx;
  font-size: 18rpx;
}

.home-header__headline {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.home-header--compact .home-header__headline {
  gap: 8rpx;
}

.home-header__title {
  display: block;
  max-width: 460rpx;
  color: #203042;
  font-size: 42rpx;
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: -0.05em;
}

.home-header--compact .home-header__title {
  max-width: 420rpx;
  font-size: 38rpx;
}

.home-header__hint-pill {
  display: inline-flex;
  width: fit-content;
  min-height: 38rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 6rpx 14rpx;
  border-radius: 9999px;
  background: rgba(255, 236, 199, 0.32);
  color: #c69021;
  font-size: 16rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.home-header--compact .home-header__hint-pill {
  min-height: 34rpx;
  padding: 4rpx 12rpx;
  font-size: 14rpx;
}

</style>
