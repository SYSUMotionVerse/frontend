<script setup lang="ts">
defineProps<{
  chip: string
  title: string
  subtitle: string
}>()
</script>

<template>
  <view class="access-entry">
    <view class="access-entry__halo access-entry__halo--gold" />
    <view class="access-entry__halo access-entry__halo--teal" />

    <view class="access-entry__inner">
      <view class="access-entry__hero">
        <text class="access-entry__chip">{{ chip }}</text>
        <text class="access-entry__title">
          {{ title }}
        </text>
        <text class="access-entry__subtitle">
          {{ subtitle }}
        </text>
      </view>

      <view class="access-entry__body">
        <slot />
      </view>
    </view>
  </view>
</template>

<style scoped>
.access-entry {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: #FCF7F0;
  padding: 56rpx 48rpx 120rpx;
  color: #1A202C;
}

.access-entry__halo {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.access-entry__halo--gold {
  top: -72rpx;
  right: -24rpx;
  width: 220rpx;
  height: 220rpx;
  background: rgba(255, 211, 132, 0.28);
}

.access-entry__halo--teal {
  top: 260rpx;
  left: -64rpx;
  width: 184rpx;
  height: 184rpx;
  background: rgba(137, 207, 255, 0.2);
}

.access-entry__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  display: flex;
  max-width: 720px;
  flex-direction: column;
  gap: 32rpx;
  animation: access-entry-reveal 180ms ease-out both;
}

.access-entry__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  text-align: left;
}

.access-entry__chip {
  color: #c76b5b;
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.access-entry__title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.access-entry__subtitle {
  display: block;
  color: #64748B;
  font-size: 24rpx;
  line-height: 1.45;
  font-weight: 600;
}

.access-entry__body {
  position: relative;
  z-index: 1;
}

@keyframes access-entry-reveal {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
