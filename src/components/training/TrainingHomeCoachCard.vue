<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  body: string
  footer: string
  tone: 'quote' | 'tip'
}>()
</script>

<template>
  <view class="coach-card-wrap">
    <view class="coach-card" :class="`coach-card--${tone}`">
      <view v-if="tone === 'quote'" class="coach-card__bubble-tail" />

      <view class="coach-card__meta">
        <text class="coach-card__eyebrow">{{ eyebrow }}</text>
        <text class="coach-card__title">{{ title }}</text>
      </view>

      <text class="coach-card__body">{{ body }}</text>

      <view class="coach-card__speaker">
        <view class="coach-card__avatar">
          <text>{{ tone === 'quote' ? '教' : '水' }}</text>
        </view>
        <text class="coach-card__footer">{{ footer }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.coach-card-wrap {
  position: relative;
  padding-bottom: 8rpx;
}

.coach-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 30rpx 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 16rpx 28rpx rgba(37, 47, 61, 0.05),
    0 8rpx 0 rgba(242, 231, 214, 0.82);
}

.coach-card--quote {
  border: 4rpx solid rgba(255, 211, 132, 0.28);
}

.coach-card--tip {
  background: rgba(184, 225, 255, 0.2);
  border: 4rpx solid rgba(184, 225, 255, 0.34);
}

.coach-card__bubble-tail {
  position: absolute;
  left: 28rpx;
  bottom: -16rpx;
  width: 32rpx;
  height: 32rpx;
  transform: rotate(45deg);
  border-right: 4rpx solid rgba(255, 211, 132, 0.28);
  border-bottom: 4rpx solid rgba(255, 211, 132, 0.28);
  background: rgba(255, 255, 255, 0.95);
}

.coach-card__meta {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.coach-card__eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8rpx 16rpx;
  border-radius: 9999px;
  background: rgba(255, 236, 199, 0.4);
  color: #d49d22;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.coach-card__title {
  display: block;
  color: #263546;
  font-size: 26rpx;
  line-height: 1.2;
  font-weight: 900;
}

.coach-card__body {
  display: block;
  color: #4e5d6d;
  font-size: 24rpx;
  line-height: 1.65;
  font-weight: 800;
}

.coach-card__speaker {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 4rpx;
}

.coach-card__avatar {
  display: inline-flex;
  width: 40rpx;
  height: 40rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(135deg, #ffd186, #ffb95f);
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 900;
  box-shadow: 0 6rpx 12rpx rgba(255, 186, 94, 0.2);
}

.coach-card__footer {
  display: block;
  color: #8c97a9;
  font-size: 18rpx;
  line-height: 1.4;
  font-weight: 800;
}
</style>
