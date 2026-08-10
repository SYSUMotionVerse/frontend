<script setup lang="ts">
import { onMounted } from 'vue'
import FloatingDock from '../navigation/FloatingDock.vue'
import {
  ensureProtectedStudentAccess,
  type ProtectedAccessMode
} from '../../composables/useNavigationGuard'

type DockTab = 'home' | 'playground' | 'growth'

const props = withDefaults(defineProps<{
  dockTab?: DockTab
  showDock?: boolean
  fitViewport?: boolean
  accessMode?: ProtectedAccessMode
}>(), {
  dockTab: 'playground',
  showDock: true,
  fitViewport: false,
  accessMode: 'browse'
})

onMounted(() => {
  void ensureProtectedStudentAccess(props.accessMode)
})
</script>

<template>
  <view
    class="training-shell"
    :class="{
      'training-shell--no-dock': !props.showDock,
      'training-shell--fit-viewport': props.fitViewport
    }"
  >
    <view class="training-shell__halo training-shell__halo--coral" />
    <view class="training-shell__halo training-shell__halo--teal" />
    <view
      class="training-shell__inner"
      :class="{
        'training-shell__inner--no-dock': !props.showDock,
        'training-shell__inner--fit-viewport': props.fitViewport
      }"
    >
      <view v-if="props.fitViewport" class="training-shell__content">
        <slot />
      </view>
      <transition v-else name="shell-enter" appear>
        <view class="training-shell__content">
          <slot />
        </view>
      </transition>
    </view>
    <FloatingDock v-if="props.showDock" :active-tab="props.dockTab" />
  </view>
</template>

<style scoped>
.training-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: #FCF7F0;
  padding: 56rpx 32rpx 216rpx;
}

.training-shell--no-dock {
  padding: 24rpx 0 0;
  overflow-y: auto;
}

.training-shell--fit-viewport {
  height: 100vh;
  box-sizing: border-box;
}

.training-shell__halo {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.training-shell__halo--coral {
  top: -80rpx;
  right: -24rpx;
  width: 220rpx;
  height: 220rpx;
  background: rgba(255, 139, 139, 0.16);
}

.training-shell__halo--teal {
  top: 300rpx;
  left: -64rpx;
  width: 184rpx;
  height: 184rpx;
  background: rgba(137, 207, 255, 0.18);
}

.training-shell__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  display: flex;
  max-width: 840px;
  flex-direction: column;
  gap: 36rpx;
}

.training-shell__inner--fit-viewport {
  height: 100%;
  gap: 0;
}

.training-shell__inner--no-dock {
  min-height: calc(100vh - 24rpx);
  height: auto;
  max-width: none;
  gap: 0;
  overflow: visible;
}

.training-shell__content {
  display: flex;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.shell-enter-enter-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.shell-enter-enter-from {
  opacity: 0;
  transform: translateY(12rpx);
}
</style>
