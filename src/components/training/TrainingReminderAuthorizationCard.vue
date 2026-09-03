<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'

const props = defineProps<{ working: boolean }>()
const emit = defineEmits<{ authorize: [] }>()
</script>

<template>
  <view class="reminder-card">
    <view class="reminder-card__icon" aria-hidden="true">
      <uni-icons type="notification-filled" size="22" color="#c76b5b" />
    </view>
    <view class="reminder-card__copy">
      <text class="reminder-card__title">开启训练提醒</text>
      <text class="reminder-card__detail">授权后可在训练时间收到微信提醒，不影响正常训练。</text>
    </view>
    <button
      class="reminder-card__action"
      type="button"
      form-type="button"
      :disabled="props.working"
      @click="emit('authorize')"
    >
      {{ props.working ? '授权中' : '前往授权' }}
    </button>
  </view>
</template>

<style scoped>
.reminder-card {
  display: flex;
  width: 100%;
  min-height: 132rpx;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 26rpx;
  border: 2rpx solid rgba(255, 139, 139, 0.2);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.94);
  box-sizing: border-box;
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.reminder-card__icon {
  display: inline-flex;
  width: 64rpx;
  height: 64rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #ffe8e5;
}

.reminder-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.reminder-card__title,
.reminder-card__detail {
  display: block;
}

.reminder-card__title {
  color: #203042;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.25;
}

.reminder-card__detail {
  color: #718096;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.45;
}

.reminder-card__action {
  display: inline-flex;
  min-width: 132rpx;
  min-height: 64rpx;
  margin: 0;
  padding: 0 18rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: #ff7777;
  color: #fffaf4;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.2;
}

.reminder-card__action::after { border: 0; }
.reminder-card__action:disabled { opacity: 0.64; }
</style>
