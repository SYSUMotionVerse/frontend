<script setup lang="ts">
import { computed } from 'vue'
import ImmersiveNavigationBar from '../layout/ImmersiveNavigationBar.vue'

const props = withDefaults(defineProps<{
  chip?: string
  title: string
  subtitle?: string
  navigationTitle?: string
  showBack?: boolean
  customBack?: boolean
  scrollTop?: number
  headingInset?: boolean
  compactTitle?: boolean
  showHero?: boolean
}>(), {
  chip: '',
  subtitle: '',
  navigationTitle: '',
  showBack: true,
  customBack: false,
  scrollTop: 0,
  headingInset: false,
  compactTitle: false,
  showHero: true
})

const resolvedNavigationTitle = computed(() => props.navigationTitle || props.title)

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <view class="access-entry">
    <view class="access-entry__halo access-entry__halo--coral" />
    <view class="access-entry__halo access-entry__halo--gold" />
    <view class="access-entry__halo access-entry__halo--teal" />
    <view class="access-entry__halo access-entry__halo--coral-soft" />
    <view class="access-entry__halo access-entry__halo--gold-soft" />
    <ImmersiveNavigationBar
      class="access-entry__navigation"
      :title="resolvedNavigationTitle"
      :show-back="props.showBack"
      :custom-back="props.customBack"
      @back="emit('back')"
    />

    <view class="access-entry__scroll-frame">
      <scroll-view
        class="access-entry__scroller"
        scroll-y
        enable-flex
        :scroll-top="props.scrollTop"
      >
        <view class="access-entry__inner">
          <view
            v-if="props.showHero"
            class="access-entry__hero"
            :class="{ 'access-entry__hero--inset': props.headingInset }"
          >
            <text v-if="chip" class="access-entry__chip">{{ chip }}</text>
            <text
              class="access-entry__title"
              :class="{ 'access-entry__title--compact': props.compactTitle }"
            >
              {{ title }}
            </text>
            <text v-if="subtitle" class="access-entry__subtitle">
              {{ subtitle }}
            </text>
            <slot name="hero-footer" />
          </view>

          <view class="access-entry__body">
            <slot />
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.access-entry {
  position: relative;
  display: flex;
  height: 100vh;
  min-height: 100vh;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background: #FCF7F0;
  padding: 0;
  color: #1A202C;
}

.access-entry__halo {
  position: fixed;
  z-index: 0;
  border-radius: 9999px;
  pointer-events: none;
}

.access-entry__halo--gold {
  top: 404rpx;
  left: -92rpx;
  width: 210rpx;
  height: 210rpx;
  background: rgba(255, 211, 132, 0.2);
}

.access-entry__halo--teal {
  top: 720rpx;
  right: -112rpx;
  width: 184rpx;
  height: 184rpx;
  background: rgba(137, 207, 255, 0.1);
}

.access-entry__halo--coral {
  top: -102rpx;
  right: -72rpx;
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 139, 139, 0.18);
}

.access-entry__halo--coral-soft {
  top: 66vh;
  left: -54rpx;
  width: 116rpx;
  height: 116rpx;
  background: rgba(255, 139, 139, 0.07);
}

.access-entry__halo--gold-soft {
  right: -44rpx;
  bottom: calc(72rpx + env(safe-area-inset-bottom));
  width: 104rpx;
  height: 104rpx;
  background: rgba(255, 211, 132, 0.09);
}

.access-entry__navigation {
  width: 100%;
  flex: none;
}

.access-entry__scroll-frame {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 0;
  flex: 1;
}

.access-entry__scroller {
  width: 100%;
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

.access-entry__inner {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  display: flex;
  width: min(720px, 100%);
  flex-direction: column;
  gap: 32rpx;
  padding: 40rpx 48rpx calc(120rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: access-entry-reveal 180ms ease-out both;
}

.access-entry__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  text-align: left;
}

.access-entry__hero--inset {
  margin-left: 32rpx;
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
  white-space: pre-line;
}

.access-entry__title--compact {
  font-size: 36rpx;
  line-height: 1.35;
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
