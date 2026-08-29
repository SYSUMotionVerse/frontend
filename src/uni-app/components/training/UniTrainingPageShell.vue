<script setup lang="ts">
import { onMounted } from 'vue'
import FloatingDock from '../navigation/FloatingDock.vue'
import ImmersiveNavigationBar from '../layout/ImmersiveNavigationBar.vue'
import {
  ensureProtectedStudentAccess,
  type ProtectedAccessMode
} from '../../composables/useNavigationGuard'

type DockTab = 'home' | 'playground' | 'growth'

const props = withDefaults(defineProps<{
  dockTab?: DockTab
  showDock?: boolean
  fitViewport?: boolean
  showDecorations?: boolean
  accessMode?: ProtectedAccessMode
  pageTitle?: string
  showBack?: boolean
  showNavigation?: boolean
}>(), {
  dockTab: 'playground',
  showDock: true,
  fitViewport: false,
  showDecorations: false,
  accessMode: 'browse',
  pageTitle: '',
  showBack: false,
  showNavigation: true
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
    <view v-if="props.showDock || props.showDecorations" class="training-shell__halo training-shell__halo--coral" />
    <view v-if="props.showDock || props.showDecorations" class="training-shell__halo training-shell__halo--gold" />
    <view v-if="props.showDock || props.showDecorations" class="training-shell__halo training-shell__halo--teal" />
    <view v-if="props.showDock || props.showDecorations" class="training-shell__halo training-shell__halo--coral-soft" />
    <view v-if="props.showDock || props.showDecorations" class="training-shell__halo training-shell__halo--gold-soft" />
    <ImmersiveNavigationBar
      v-if="props.showNavigation && props.pageTitle"
      :title="props.pageTitle"
      :show-back="props.showBack"
    />
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: #FCF7F0;
  padding: 0 32rpx calc(132rpx + env(safe-area-inset-bottom));
}

.training-shell--no-dock {
  padding: 0;
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
  position: fixed;
  z-index: 0;
  border-radius: 9999px;
  pointer-events: none;
}

.training-shell__halo--coral {
  top: -102rpx;
  right: -72rpx;
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 139, 139, 0.18);
}

.training-shell__halo--gold {
  top: 404rpx;
  left: -92rpx;
  width: 210rpx;
  height: 210rpx;
  background: rgba(255, 211, 132, 0.2);
}

.training-shell__halo--teal {
  top: 720rpx;
  right: -112rpx;
  width: 184rpx;
  height: 184rpx;
  background: rgba(137, 207, 255, 0.1);
}

.training-shell__halo--coral-soft {
  top: 66vh;
  left: -54rpx;
  width: 116rpx;
  height: 116rpx;
  background: rgba(255, 139, 139, 0.07);
}

.training-shell__halo--gold-soft {
  top: auto;
  right: -44rpx;
  bottom: calc(190rpx + env(safe-area-inset-bottom));
  width: 104rpx;
  height: 104rpx;
  background: rgba(255, 211, 132, 0.09);
}

.training-shell__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: min(880px, 100%);
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 36rpx;
  padding-top: 0;
}

.training-shell__inner--fit-viewport {
  height: auto;
  gap: 0;
  padding-top: 0;
}

.training-shell__inner--no-dock {
  min-height: 0;
  height: auto;
  max-width: none;
  gap: 0;
  overflow: visible;
}

.training-shell__inner--no-dock.training-shell__inner--fit-viewport {
  height: auto;
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
