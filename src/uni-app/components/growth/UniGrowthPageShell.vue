<script setup lang="ts">
import { computed, onMounted } from 'vue'
import FloatingDock from '../navigation/FloatingDock.vue'
import ImmersiveNavigationBar from '../layout/ImmersiveNavigationBar.vue'
import { useFloatingDockLayout } from '../../composables/useFloatingDockLayout'
import { ensureProtectedStudentAccess } from '../../composables/useNavigationGuard'

type DockTab = 'home' | 'playground' | 'growth'

const props = withDefaults(defineProps<{
  dockTab?: DockTab
  showDock?: boolean
  pageTitle?: string
  showBack?: boolean
  refreshEnabled?: boolean
  refreshing?: boolean
}>(), {
  dockTab: 'growth',
  showDock: true,
  pageTitle: '',
  showBack: false,
  refreshEnabled: false,
  refreshing: false
})

const emit = defineEmits<{
  refresh: []
}>()

const { contentClearancePx } = useFloatingDockLayout()
const shellStyle = computed(() => ({
  '--floating-dock-content-clearance': `${contentClearancePx.value}px`
}))

onMounted(() => {
  void ensureProtectedStudentAccess('browse')
})
</script>

<template>
  <view
    class="growth-shell"
    :class="{
      'growth-shell--no-dock': !props.showDock,
      'growth-shell--refreshable': props.refreshEnabled
    }"
    :style="shellStyle"
  >
    <view class="growth-shell__halo growth-shell__halo--coral" />
    <view class="growth-shell__halo growth-shell__halo--gold" />
    <view class="growth-shell__halo growth-shell__halo--teal" />
    <view class="growth-shell__halo growth-shell__halo--coral-soft" />
    <view class="growth-shell__halo growth-shell__halo--gold-soft" />
    <ImmersiveNavigationBar
      v-if="props.pageTitle"
      :title="props.pageTitle"
      :show-back="props.showBack"
    />
    <view
      v-if="props.refreshEnabled"
      class="growth-shell__scroll-frame"
    >
      <scroll-view
        class="growth-shell__inner growth-shell__inner--refreshable"
        scroll-y
        enable-flex
        refresher-enabled
        :refresher-threshold="140"
        refresher-background="transparent"
        :refresher-triggered="props.refreshing"
        @refresherrefresh="emit('refresh')"
      >
        <view class="growth-shell__content">
          <slot />
          <view
            v-if="props.showDock"
            class="growth-shell__dock-clearance"
            aria-hidden="true"
          />
          <view
            v-else
            class="growth-shell__secondary-clearance"
            aria-hidden="true"
          />
        </view>
      </scroll-view>
    </view>
    <view v-else class="growth-shell__inner">
      <transition name="shell-enter" appear>
        <view class="growth-shell__content">
          <slot />
          <view
            v-if="props.showDock"
            class="growth-shell__dock-clearance"
            aria-hidden="true"
          />
          <view
            v-else
            class="growth-shell__secondary-clearance"
            aria-hidden="true"
          />
        </view>
      </transition>
    </view>
    <FloatingDock v-if="props.showDock" :active-tab="props.dockTab" />
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
  padding: 0;
}

.growth-shell--no-dock {
  padding-bottom: 0;
}

.growth-shell--refreshable {
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
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
  margin: 0;
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  padding-top: 0;
}

.growth-shell__content {
  display: flex;
  width: min(880px, 100%);
  margin: 0 auto;
  padding: 16rpx 32rpx 0;
  box-sizing: border-box;
  flex-direction: column;
  gap: 32rpx;
}

.growth-shell__dock-clearance {
  width: 100%;
  height: var(--floating-dock-content-clearance, 100px);
  min-height: var(--floating-dock-content-clearance, 100px);
  flex: 0 0 var(--floating-dock-content-clearance, 100px);
  pointer-events: none;
}

.growth-shell__secondary-clearance {
  width: 100%;
  height: calc(56rpx + env(safe-area-inset-bottom));
  min-height: calc(56rpx + env(safe-area-inset-bottom));
  flex: 0 0 calc(56rpx + env(safe-area-inset-bottom));
  pointer-events: none;
}

.growth-shell__inner--refreshable {
  height: 100%;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(
    180deg,
    transparent 0,
    rgba(0, 0, 0, 0.5) 16rpx,
    #000 32rpx,
    #000 100%
  );
  mask-image: linear-gradient(
    180deg,
    transparent 0,
    rgba(0, 0, 0, 0.5) 16rpx,
    #000 32rpx,
    #000 100%
  );
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.growth-shell__scroll-frame {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 0;
  flex: 1;
}

.shell-enter-enter-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.shell-enter-enter-from {
  opacity: 0;
  transform: translateY(12rpx);
}
</style>
