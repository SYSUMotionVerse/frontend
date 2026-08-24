<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  body: string
  footer: string
}>()
</script>

<template>
  <view class="coach-card">
    <view class="coach-card__meta">
      <text class="coach-card__eyebrow">{{ eyebrow }}</text>
      <text class="coach-card__title">{{ title }}</text>
    </view>

    <text class="coach-card__body">{{ body }}</text>
    <text class="coach-card__footer">{{ footer }}</text>
  </view>
</template>

<style scoped>
.coach-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 28rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.coach-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.coach-card__eyebrow {
  display: block;
  color: #c76b5b;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.coach-card__title {
  display: block;
  color: #203042;
  font-size: 27rpx;
  line-height: 1.2;
  font-weight: 800;
}

.coach-card__body {
  display: block;
  color: #718096;
  font-size: 23rpx;
  line-height: 1.58;
  font-weight: 700;
}

.coach-card__footer {
  display: block;
  padding-top: 12rpx;
  border-top: 2rpx solid rgba(224, 111, 120, 0.1);
  color: #8a97a8;
  font-size: 20rpx;
  line-height: 1.4;
  font-weight: 700;
}
</style>
