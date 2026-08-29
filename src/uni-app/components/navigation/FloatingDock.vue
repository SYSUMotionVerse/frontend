<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, onMounted, shallowRef } from 'vue'

type DockTab = 'home' | 'playground' | 'growth'
type DockIcon = 'home-filled' | 'fire-filled' | 'medal-filled'

const props = defineProps<{
  activeTab: DockTab
}>()

const bottomGapPx = shallowRef(42)
const dockStyle = computed(() => ({
  '--floating-dock-bottom-gap': `${bottomGapPx.value}px`
}))

onMounted(() => {
  if (typeof uni === 'undefined') {
    return
  }

  const windowInfo = typeof uni.getWindowInfo === 'function'
    ? uni.getWindowInfo()
    : typeof uni.getSystemInfoSync === 'function'
      ? uni.getSystemInfoSync()
      : undefined
  if (!windowInfo) return

  const safeAreaInsets = (windowInfo as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets
  const safeArea = (windowInfo as {
    safeArea?: { bottom?: number }
    windowHeight?: number
    windowWidth?: number
  }).safeArea
  const windowHeight = windowInfo.windowHeight ?? 0
  const windowWidth = windowInfo.windowWidth ?? 375
  const safeAreaBottom = Math.max(
    0,
    safeAreaInsets?.bottom
      ?? (safeArea?.bottom === undefined ? 0 : windowHeight - safeArea.bottom)
  )
  const baseGapPx = 16 * windowWidth / 750
  const targetTotalBottomPx = baseGapPx + 34

  bottomGapPx.value = Math.max(baseGapPx, targetTotalBottomPx - safeAreaBottom)
})

const dockItems: Array<{
  key: DockTab
  label: string
  icon: DockIcon
  url: string
}> = [
  {
    key: 'home',
    label: '首页',
    icon: 'home-filled',
    url: '/pages/training/home'
  },
  {
    key: 'playground',
    label: '运动',
    icon: 'fire-filled',
    url: '/pages/training/select'
  },
  {
    key: 'growth',
    label: '成长',
    icon: 'medal-filled',
    url: '/pages/growth/index'
  }
]
</script>

<template>
  <view class="floating-dock" :style="dockStyle">
    <view
      v-for="(item, index) in dockItems"
      :key="item.key"
      :class="[
        'floating-dock__cell',
        { 'floating-dock__cell--divided': index > 0 }
      ]"
    >
      <view
        v-if="item.key === props.activeTab"
        class="floating-dock__item floating-dock__item--active"
      >
        <view class="floating-dock__icon floating-dock__icon--active">
          <uni-icons class="floating-dock__glyph" :type="item.icon" size="20" color="#ffffff" />
        </view>
        <text class="floating-dock__label floating-dock__label--active">{{ item.label }}</text>
      </view>

      <navigator
        v-else
        class="floating-dock__item"
        hover-class="floating-dock__item--pressed"
        open-type="redirect"
        :url="item.url"
      >
        <view class="floating-dock__icon">
          <uni-icons class="floating-dock__glyph" :type="item.icon" size="16" color="#7f95b2" />
        </view>
        <text class="floating-dock__label">{{ item.label }}</text>
      </navigator>
    </view>
  </view>
</template>

<style scoped>
.floating-dock {
  position: fixed;
  left: 104rpx;
  right: 104rpx;
  bottom: calc(var(--floating-dock-bottom-gap, 42px) + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  height: 98rpx;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  box-sizing: border-box;
  padding: 19rpx 2rpx;
  border: 2rpx solid rgba(234, 216, 190, 0.82);
  border-radius: 9999px;
  background: rgba(255, 252, 248, 0.97);
  box-shadow:
    0 18rpx 38rpx rgba(37, 47, 61, 0.15),
    0 6rpx 12rpx rgba(90, 72, 52, 0.08),
    0 4rpx 0 rgba(244, 231, 208, 0.68);
}

.floating-dock__cell {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.floating-dock__item {
  display: flex;
  width: 100%;
  height: 56rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-sizing: border-box;
  padding: 0 4rpx;
  border-radius: 9999px;
  text-decoration: none;
}

.floating-dock__item--active {
  width: 144rpx;
  height: 56rpx;
  max-width: calc(100% - 8rpx);
  justify-content: center;
  gap: 8rpx;
  padding: 0;
  border-radius: 28rpx;
  background: #ff6f6f;
  box-shadow: 0 3rpx 8rpx rgba(222, 92, 92, 0.16);
}

.floating-dock__cell--divided::before {
  position: absolute;
  left: 0;
  top: 50%;
  width: 2rpx;
  height: 36rpx;
  border-radius: 9999px;
  background: rgba(225, 203, 171, 0.68);
  content: '';
  transform: translateY(-50%);
}

.floating-dock__item--pressed {
  opacity: 0.78;
}

.floating-dock__icon {
  display: inline-flex;
  width: 56rpx;
  height: 56rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(221, 235, 247, 0.92);
  color: #7f95b2;
}

.floating-dock__icon--active {
  width: 40rpx;
  height: 56rpx;
  background: transparent;
  color: #ffffff;
}

.floating-dock__glyph {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: middle;
}

.floating-dock__label {
  display: block;
  color: #90a0ba;
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0;
  white-space: nowrap;
}

.floating-dock__label--active {
  color: #ffffff;
}
</style>
