<script setup lang="ts">
import { onMounted } from 'vue'
import FloatingDock from '../navigation/FloatingDock.vue'
import ImmersiveNavigationBar from '../layout/ImmersiveNavigationBar.vue'
import { ensureProtectedStudentAccess } from '../../composables/useNavigationGuard'

type DockTab = 'home' | 'playground' | 'growth'

withDefaults(defineProps<{
  dockTab?: DockTab
  showDock?: boolean
  pageTitle?: string
  showBack?: boolean
}>(), {
  dockTab: 'growth',
  showDock: true,
  pageTitle: '',
  showBack: false
})

onMounted(() => {
  void ensureProtectedStudentAccess('browse')
})
</script>

<template>
  <view class="growth-shell">
    <view class="growth-shell__halo growth-shell__halo--coral" />
    <view class="growth-shell__halo growth-shell__halo--gold" />
    <view class="growth-shell__halo growth-shell__halo--teal" />
    <view class="growth-shell__halo growth-shell__halo--coral-soft" />
    <view class="growth-shell__halo growth-shell__halo--gold-soft" />
    <ImmersiveNavigationBar v-if="pageTitle" :title="pageTitle" :show-back="showBack" />
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 100vh;
  box-sizing: border-box;
  background: #FCF7F0;
  padding: 0 32rpx calc(132rpx + env(safe-area-inset-bottom));
}

.growth-shell__halo {
  position: fixed;
  z-index: 0;
  border-radius: 9999px;
  pointer-events: none;
}

.growth-shell__halo--coral {
  top: -102rpx;
  right: -72rpx;
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 139, 139, 0.18);
}

.growth-shell__halo--gold {
  top: 404rpx;
  left: -92rpx;
  width: 210rpx;
  height: 210rpx;
  background: rgba(255, 211, 132, 0.2);
}

.growth-shell__halo--teal {
  top: 746rpx;
  right: -104rpx;
  width: 176rpx;
  height: 176rpx;
  background: rgba(137, 207, 255, 0.1);
}

.growth-shell__halo--coral-soft {
  top: 66vh;
  left: -54rpx;
  width: 116rpx;
  height: 116rpx;
  background: rgba(255, 139, 139, 0.07);
}

.growth-shell__halo--gold-soft {
  top: auto;
  right: -44rpx;
  bottom: calc(190rpx + env(safe-area-inset-bottom));
  width: 104rpx;
  height: 104rpx;
  background: rgba(255, 211, 132, 0.09);
}

.growth-shell__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: min(880px, 100%);
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  padding-top: 0;
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
