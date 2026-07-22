<script setup lang="ts">
import FloatingDock from '../navigation/FloatingDock.vue'

type DockTab = 'home' | 'playground' | 'growth'

withDefaults(defineProps<{
  dockTab?: DockTab
  showDock?: boolean
}>(), {
  dockTab: 'growth',
  showDock: true
})
</script>

<template>
  <view class="growth-shell">
    <view class="growth-shell__halo growth-shell__halo--coral" />
    <view class="growth-shell__halo growth-shell__halo--gold" />
    <view class="growth-shell__inner">
      <transition name="shell-enter" appear>
        <view class="growth-shell__content">
          <slot />
        </view>
      </transition>
    </view>
    <FloatingDock v-if="showDock" :active-tab="dockTab" />
  </view>
</template>

<style scoped>
.growth-shell {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  background: #FCF7F0;
  padding: 56rpx 32rpx 216rpx;
}

.growth-shell__halo {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.growth-shell__halo--coral {
  top: -88rpx;
  right: -36rpx;
  width: 240rpx;
  height: 240rpx;
  background: rgba(255, 139, 139, 0.18);
}

.growth-shell__halo--gold {
  top: 320rpx;
  left: -72rpx;
  width: 180rpx;
  height: 180rpx;
  background: rgba(255, 211, 132, 0.2);
}

.growth-shell__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: min(880px, 100%);
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.growth-shell__content {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 32rpx;
}

.shell-enter-enter-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.shell-enter-enter-from {
  opacity: 0;
  transform: translateY(12rpx);
}
</style>
