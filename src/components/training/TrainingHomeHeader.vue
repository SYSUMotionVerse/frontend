<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  avatarUrl: string
  displayName: string
  reminderLabel: string
  miniTag?: string
  title?: string
  titlePill?: string
  variant?: 'home' | 'compact'
  avatarUploadState?: 'idle' | 'uploading' | 'success' | 'error'
  avatarErrorMessage?: string
  isWechatMiniProgram?: boolean
  supportsWechatAvatarSelection?: boolean
  unreadCount?: number
}>(), {
  miniTag: "TODAY'S QUEST",
  title: '今天先完成主线任务',
  titlePill: '训练首页',
  variant: 'home',
  avatarUploadState: 'idle',
  avatarErrorMessage: '',
  isWechatMiniProgram: false,
  supportsWechatAvatarSelection: false,
  unreadCount: 0
})

const emit = defineEmits<{
  chooseWechatAvatar: [event: { detail?: { avatarUrl?: string } }]
  openNotifications: []
}>()
const headerClasses = computed(() => ['home-header', `home-header--${props.variant}`])
</script>

<template>
  <view :class="headerClasses">
    <view class="home-header__topbar">
      <view class="home-header__profile">
        <button
          class="home-header__avatar-trigger"
          :open-type="props.isWechatMiniProgram && props.supportsWechatAvatarSelection ? 'chooseAvatar' : undefined"
          @chooseavatar="emit('chooseWechatAvatar', $event)"
        >
          <view class="home-header__avatar-shell">
            <image class="home-header__avatar" :src="props.avatarUrl" mode="aspectFill" />
            <text v-if="props.avatarUploadState === 'uploading'" class="home-header__avatar-overlay">
              上传中
            </text>
          </view>
        </button>

        <view class="home-header__copy">
          <text class="home-header__name">你好，{{ props.displayName }}</text>
          <text class="home-header__mini-tag">{{ props.miniTag }}</text>
        </view>
      </view>

      <button
        class="home-header__bell-shell"
        aria-label="查看训练提醒"
        @click="emit('openNotifications')"
      >
        <text v-if="props.unreadCount > 0" class="home-header__bell-badge">
          {{ props.unreadCount > 99 ? '99+' : props.unreadCount }}
        </text>
        <text class="home-header__bell">铃</text>
      </button>
    </view>

    <text class="home-header__status">{{ props.reminderLabel }}</text>

    <view class="home-header__headline">
      <text class="home-header__hint-pill">{{ props.titlePill }}</text>
      <text class="home-header__title">{{ props.title }}</text>
    </view>

    <text v-if="props.avatarErrorMessage" class="home-header__avatar-message">
      {{ props.avatarErrorMessage }}
    </text>
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

.home-header__avatar-trigger {
  display: inline-flex;
  margin: 0;
  padding: 0;
  background: transparent;
}

.home-header__avatar-trigger::after {
  border: none;
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

.home-header__avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(32, 48, 66, 0.48);
  color: #ffffff;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
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
  font-size: 46rpx;
  line-height: 1.06;
  font-weight: 900;
  letter-spacing: -0.05em;
}

.home-header--compact .home-header__name {
  font-size: 40rpx;
}

.home-header__mini-tag {
  display: block;
  color: #ff8b8b;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
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

.home-header__bell {
  color: #ff8c93;
  font-size: 36rpx;
  line-height: 1;
  font-weight: 900;
}

.home-header--compact .home-header__bell {
  font-size: 30rpx;
}

.home-header__status {
  display: block;
  margin-top: -16rpx;
  color: #9b896e;
  font-size: 20rpx;
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
  font-size: 52rpx;
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: -0.05em;
}

.home-header--compact .home-header__title {
  max-width: 420rpx;
  font-size: 44rpx;
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

.home-header__avatar-message {
  color: #92400E;
  font-size: 22rpx;
  line-height: 1.45;
  font-weight: 700;
}
</style>
