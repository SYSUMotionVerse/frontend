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
    <view v-if="props.showDock && !props.fitViewport" class="training-shell__halo training-shell__halo--coral" />
    <view v-if="props.showDock && !props.fitViewport" class="training-shell__halo training-shell__halo--gold" />
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
  padding: 56rpx 32rpx calc(216rpx + env(safe-area-inset-bottom));
}

.training-shell--no-dock {
  padding: 24rpx 0 0;
  overflow-y: auto;
}

.training-shell--fit-viewport {
  height: 100vh;
  box-sizing: border-box;
}

.training-shell--no-dock.training-shell--fit-viewport {
  padding: 0;
}

.training-shell__halo {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.training-shell__halo--coral {
  top: -88rpx;
  right: -36rpx;
  width: 240rpx;
  height: 240rpx;
  background: rgba(255, 139, 139, 0.18);
}

.training-shell__halo--gold {
  top: 320rpx;
  left: -72rpx;
  width: 180rpx;
  height: 180rpx;
  background: rgba(255, 211, 132, 0.2);
}

.training-shell__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: min(880px, 100%);
  display: flex;
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

.training-shell__inner--no-dock.training-shell__inner--fit-viewport {
  height: 100%;
  min-height: 0;
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
