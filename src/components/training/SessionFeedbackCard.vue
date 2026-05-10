<script setup lang="ts">
defineProps<{
  modalityLabel: string
  qualityScore: number
  summary: string
}>()
</script>

<template>
  <view class="card-shell session-feedback-card">
    <view class="session-feedback-card__hero-badge">
      <text>🎉</text>
    </view>
    <view class="session-feedback-card__sticker">
      <text>太棒了！</text>
    </view>

    <view class="session-feedback-card__hero text-center">
      <view class="chip-soft bg-brand-leaf/15 text-[#065F46] border-2 border-brand-leaf/25 mx-auto mb-[32rpx]">
        <text>训练已完成</text>
      </view>
      <text class="block text-[56rpx] font-900 text-brand-ink tracking-tight">{{ modalityLabel }} 反馈</text>
      <text class="block mt-[16rpx] text-[36rpx] leading-snug text-slate-600 font-700">
        完成已记录，质量反馈有助于优化下次训练。
      </text>
    </view>

    <view class="session-feedback-card__summary-grid">
      <view class="session-feedback-card__score-tile">
        <text class="block text-[24rpx] uppercase tracking-widest text-white/60 font-800">质量分</text>
        <text class="block mt-[20rpx] text-[88rpx] font-900 text-white">{{ qualityScore }}</text>
      </view>
      <view class="session-feedback-card__score-tile session-feedback-card__score-tile--soft">
        <text class="block text-[24rpx] uppercase tracking-widest text-[#2B7CB8] font-800">鼓励</text>
        <text class="block mt-[16rpx] text-[32rpx] leading-snug text-brand-ink font-bold">{{ summary }}</text>
      </view>
    </view>

    <view class="session-feedback-card__footer-chip">
        <text>🎉</text>
      <text>{{ qualityScore >= 85 ? '状态很棒，继续保持' : qualityScore >= 65 ? '节奏不错，继续进步' : '需要改进，建议多练习' }}</text>
    </view>
  </view>
</template>

<style scoped>
.session-feedback-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  text-align: center;
}

.session-feedback-card__hero {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.session-feedback-card__hero-badge {
  display: inline-flex;
  width: 124rpx;
  height: 124rpx;
  align-self: center;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 8rpx solid #ffffff;
  background: rgba(255, 139, 139, 0.2);
  box-shadow: 0 12rpx 0 rgba(255, 139, 139, 0.16);
  font-size: 56rpx;
}

.session-feedback-card__sticker {
  display: inline-flex;
  width: fit-content;
  align-self: center;
  align-items: center;
  justify-content: center;
  padding: 10rpx 22rpx;
  border-radius: 9999px;
  border: 4rpx solid #ffffff;
  background: #ffd384;
  box-shadow: 0 8rpx 0 rgba(255, 211, 132, 0.22);
  color: #1a202c;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transform: rotate(-5deg);
}

.session-feedback-card__summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.session-feedback-card__score-tile {
  flex: 1 1 240rpx;
  min-width: 0;
  display: flex;
  min-height: 200rpx;
  flex-direction: column;
  justify-content: center;
  border-radius: 40rpx;
  padding: 32rpx;
}

.session-feedback-card__score-tile {
  background: #1A202C;
  box-shadow: 0 10rpx 0 rgba(26, 32, 44, 0.12);
}

.session-feedback-card__score-tile--soft {
  border: 6rpx solid rgba(255, 211, 132, 0.24);
  background: rgba(255, 211, 132, 0.22);
  box-shadow: none;
}

.session-feedback-card__footer-chip {
  margin-top: 32rpx;
  display: inline-flex;
  align-self: center;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 32rpx;
  border-radius: 9999px;
  border: 2rpx solid rgba(43, 124, 184, 0.14);
  background: rgba(137, 207, 255, 0.12);
  color: #2B7CB8;
  font-size: 28rpx;
  font-weight: 800;
}
</style>
