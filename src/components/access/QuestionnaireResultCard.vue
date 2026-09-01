<script setup lang="ts">
withDefaults(defineProps<{
  questionnaireCount?: number
}>(), {
  questionnaireCount: 1
})

const emit = defineEmits<{
  home: []
  train: []
}>()
</script>

<template>
  <view class="result-card">
    <view class="result-card__status">
      <text>全部完成</text>
    </view>

    <view class="result-card__copy">
      <text class="result-card__title">太棒了，你已经完成本次问卷！</text>
      <text class="result-card__description">
        {{ questionnaireCount }} 份问卷的回答都已妥善保存。谢谢你认真记录自己的真实感受。
      </text>
    </view>

    <view class="result-card__summary">
      <text class="result-card__summary-value">{{ questionnaireCount }} 份</text>
      <text class="result-card__summary-label">本次已完成</text>
    </view>

    <text class="result-card__next-copy">接下来想先看看首页，还是直接选择一项训练？</text>

    <view class="result-card__actions">
      <button class="result-card__button result-card__button--secondary" type="button" @click="emit('home')">
        <text>先去首页</text>
      </button>
      <button class="result-card__button result-card__button--primary" type="button" @click="emit('train')">
        <text>直接开练</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.result-card {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  padding: 44rpx 36rpx;
  border: 6rpx solid rgba(255, 211, 132, 0.28);
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12rpx 0 rgba(0, 0, 0, 0.05);
  text-align: center;
}

.result-card__status {
  display: inline-flex;
  width: fit-content;
  align-self: center;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(118, 174, 112, 0.16);
  color: #357652;
  font-size: 22rpx;
  font-weight: 900;
}

.result-card__copy {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.result-card__title {
  color: #1a202c;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.35;
}

.result-card__description,
.result-card__next-copy {
  color: #64748b;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.6;
}

.result-card__summary {
  display: flex;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(137, 207, 255, 0.12);
}

.result-card__summary-value {
  color: #2b7cb8;
  font-size: 40rpx;
  font-weight: 900;
}

.result-card__summary-label {
  color: #536176;
  font-size: 24rpx;
  font-weight: 800;
}

.result-card__actions {
  display: flex;
  gap: 24rpx;
  margin-top: 8rpx;
}

.result-card__button {
  height: 88rpx;
  min-width: 0;
  flex: 1;
  margin: 0;
  padding: 0 12rpx;
  border-radius: 24rpx;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 88rpx;
}

.result-card__button::after {
  border: none;
}

.result-card__button--secondary {
  border: 2rpx solid #ff8b7b;
  background: rgba(255, 250, 244, 0.68);
  color: #ff6f62;
}

.result-card__button--primary {
  border: 0;
  background: #ff8b8b;
  box-shadow: 0 8rpx 0 #de7272;
  color: #1a202c;
}
</style>
