<script setup lang="ts">
import { computed, onMounted } from 'vue'
import FloatingDock from '../navigation/FloatingDock.vue'
import ImmersiveNavigationBar from '../layout/ImmersiveNavigationBar.vue'
import { useFloatingDockLayout } from '../../composables/useFloatingDockLayout'
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
  customBack?: boolean
  showNavigation?: boolean
  refreshEnabled?: boolean
  refreshing?: boolean
}>(), {
  dockTab: 'playground',
  showDock: true,
  fitViewport: false,
  showDecorations: false,
  accessMode: 'browse',
  pageTitle: '',
  showBack: false,
  customBack: false,
  showNavigation: true,
  refreshEnabled: false,
  refreshing: false
})

const emit = defineEmits<{
  refresh: []
  back: []
}>()

const { contentClearancePx } = useFloatingDockLayout()
const shellStyle = computed(() => ({
  '--floating-dock-content-clearance': `${contentClearancePx.value}px`
}))

onMounted(() => {
  void ensureProtectedStudentAccess(props.accessMode)
})
</script>

<template>
  <view
    class="training-shell"
    :style="shellStyle"
    :class="{
      'training-shell--no-dock': !props.showDock,
      'training-shell--fit-viewport': props.fitViewport,
      'training-shell--refreshable': props.refreshEnabled
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
      :custom-back="props.customBack"
      @back="emit('back')"
    />
    <view
      v-if="props.refreshEnabled"
      class="training-shell__scroll-frame"
    >
      <scroll-view
        class="training-shell__inner training-shell__inner--refreshable"
        :class="{ 'training-shell__inner--no-dock': !props.showDock }"
        scroll-y
        enable-flex
        refresher-enabled
        :refresher-threshold="140"
        refresher-background="transparent"
        :refresher-triggered="props.refreshing"
        @refresherrefresh="emit('refresh')"
      >
        <view
          class="training-shell__content"
          :class="{ 'training-shell__content--padded': props.showDock }"
        >
          <slot />
          <view
            v-if="props.showDock"
            class="training-shell__dock-clearance"
            aria-hidden="true"
          />
        </view>
      </scroll-view>
    </view>
    <view
      v-else
      class="training-shell__inner"
      :class="{
        'training-shell__inner--no-dock': !props.showDock,
        'training-shell__inner--fit-viewport': props.fitViewport
      }"
    >
      <view
        v-if="props.fitViewport" class="training-shell__content"
        :class="{ 'training-shell__content--padded': props.showDock }"
      >
        <slot />
        <view
          v-if="props.showDock"
          class="training-shell__dock-clearance"
          aria-hidden="true"
        />
      </view>
      <transition v-else name="shell-enter" appear>
        <view
          class="training-shell__content"
          :class="{ 'training-shell__content--padded': props.showDock }"
        >
          <slot />
          <view
            v-if="props.showDock"
            class="training-shell__dock-clearance"
            aria-hidden="true"
          />
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
  padding: 0;
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

.training-shell--refreshable,
.training-shell--no-dock.training-shell--refreshable {
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
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
  margin: 0;
  width: 100%;
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

.training-shell__inner--refreshable,
.training-shell__inner--no-dock.training-shell__inner--refreshable {
  height: 100%;
  min-height: 0;
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

.training-shell__content {
  display: flex;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding-top: 16rpx;
  box-sizing: border-box;
}

.training-shell__content--padded {
  width: min(880px, 100%);
  margin: 0 auto;
  padding: 16rpx 32rpx 0;
  box-sizing: border-box;
}

.training-shell__scroll-frame {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 0;
  flex: 1;
}

.training-shell__dock-clearance {
  width: 100%;
  height: var(--floating-dock-content-clearance, 100px);
  min-height: var(--floating-dock-content-clearance, 100px);
  flex: 0 0 var(--floating-dock-content-clearance, 100px);
  pointer-events: none;
}

.shell-enter-enter-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.shell-enter-enter-from {
  opacity: 0;
  transform: translateY(12rpx);
}
</style>
