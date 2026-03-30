<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  posterTone: 'sky' | 'sand'
  timeLabel: string
}>()
</script>

<template>
  <view class="feature-card">
    <view class="feature-card__poster" :class="`feature-card__poster--${posterTone}`">
      <view class="feature-card__poster-stripe" />
      <view class="feature-card__screen-glow" />

      <view class="feature-card__frame">
        <view class="feature-card__video">
          <view class="feature-card__screen">
            <view class="feature-card__screen-sky" />
            <view class="feature-card__screen-line" />
            <view class="feature-card__screen-play">
              <view class="feature-card__play">
                <text>▶</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="feature-card__time-pill">
        <text>{{ timeLabel }}</text>
      </view>
    </view>

    <view class="feature-card__body">
      <view class="feature-card__meta">
        <text class="feature-card__eyebrow">{{ eyebrow }}</text>
      </view>
      <text class="feature-card__title">{{ title }}</text>
      <text class="feature-card__description">{{ description }}</text>
    </view>
  </view>
</template>

<style scoped>
.feature-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.feature-card__poster {
  position: relative;
  height: 206rpx;
  border-radius: 28rpx;
  padding: 24rpx;
  overflow: hidden;
  box-shadow:
    0 18rpx 30rpx rgba(37, 47, 61, 0.08),
    0 10rpx 0 rgba(232, 221, 203, 0.78);
}

.feature-card__poster--sky {
  background: linear-gradient(135deg, #7d95a2, #d8ecff);
}

.feature-card__poster--sand {
  background: linear-gradient(135deg, #c69962, #f1ddb8);
}

.feature-card__poster-stripe {
  position: absolute;
  top: 0;
  right: 64rpx;
  width: 16rpx;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
  transform: skewX(-12deg);
}

.feature-card__screen-glow {
  position: absolute;
  right: -12rpx;
  bottom: -18rpx;
  width: 180rpx;
  height: 120rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.18);
}

.feature-card__frame {
  position: relative;
  display: flex;
  width: 238rpx;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: rgba(66, 79, 90, 0.28);
  box-shadow:
    12rpx 0 0 rgba(31, 44, 55, 0.18),
    inset 0 0 0 4rpx rgba(255, 255, 255, 0.14);
}

.feature-card__video {
  display: flex;
  width: 168rpx;
  height: 136rpx;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
  background: #f4efe8;
  overflow: hidden;
  box-shadow: inset -10rpx 0 18rpx rgba(0, 0, 0, 0.18);
}

.feature-card__screen {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #c4dcf0, #f5e0ba 72%, #b19774 72%, #a78b65 100%);
}

.feature-card__screen-sky {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  width: 128rpx;
  height: 18rpx;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.26);
}

.feature-card__screen-line {
  position: absolute;
  bottom: 34rpx;
  left: 0;
  right: 0;
  height: 2rpx;
  background: rgba(255, 255, 255, 0.4);
}

.feature-card__screen-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-card__play {
  display: inline-flex;
  width: 68rpx;
  height: 68rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.98);
  color: #ffb129;
  font-size: 28rpx;
  font-weight: 900;
  box-shadow: 0 10rpx 18rpx rgba(255, 177, 41, 0.22);
}

.feature-card__time-pill {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  display: inline-flex;
  min-height: 38rpx;
  align-items: center;
  justify-content: center;
  padding: 8rpx 16rpx;
  border-radius: 9999px;
  background: rgba(255, 139, 139, 0.92);
  color: #ffffff;
  font-size: 16rpx;
  font-weight: 900;
  box-shadow: 0 6rpx 14rpx rgba(255, 139, 139, 0.18);
}

.feature-card__body {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 2rpx 4rpx 0;
}

.feature-card__eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8rpx 16rpx;
  border-radius: 9999px;
  background: rgba(184, 225, 255, 0.26);
  color: #5d789a;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.feature-card__title {
  display: block;
  color: #223244;
  font-size: 30rpx;
  line-height: 1.25;
  font-weight: 900;
}

.feature-card__description {
  display: block;
  color: #798799;
  font-size: 20rpx;
  line-height: 1.45;
  font-weight: 700;
}
</style>
