<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, onMounted, shallowRef } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  showBack?: boolean
}>(), {
  showBack: false
})

type MenuButtonRect = {
  top: number
  bottom: number
  left: number
  right: number
  height: number
}

const metrics = shallowRef({
  statusBarHeight: 20,
  barHeight: 44,
  sideClearance: 56
})

const navigationStyle = computed(() => ({
  height: `calc(${metrics.value.statusBarHeight + metrics.value.barHeight}px - 16rpx)`,
  paddingTop: `${metrics.value.statusBarHeight}px`,
  '--immersive-nav-side-clearance': `${metrics.value.sideClearance}px`
}))

function readMenuButtonRect(): MenuButtonRect | undefined {
  if (typeof wx === 'undefined' || typeof wx.getMenuButtonBoundingClientRect !== 'function') {
    return undefined
  }

  const rect = wx.getMenuButtonBoundingClientRect()
  return rect && rect.height > 0 ? rect : undefined
}

function updateMetrics() {
  const windowInfo = typeof uni !== 'undefined' && typeof uni.getWindowInfo === 'function'
    ? uni.getWindowInfo()
    : undefined
  const statusBarHeight = windowInfo?.statusBarHeight ?? 20
  const windowWidth = windowInfo?.windowWidth ?? 375
  const menuButton = readMenuButtonRect()

  if (!menuButton) {
    metrics.value = {
      statusBarHeight,
      barHeight: 44,
      sideClearance: 56
    }
    return
  }

  const verticalGap = Math.max(menuButton.top - statusBarHeight, 4)
  metrics.value = {
    statusBarHeight,
    barHeight: menuButton.height + verticalGap * 2,
    sideClearance: Math.max(windowWidth - menuButton.left + 8, 56)
  }
}

function goBack() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pages.length > 1) {
    void uni.navigateBack()
    return
  }

  void uni.reLaunch({ url: '/pages/access/startup' })
}

onMounted(updateMetrics)
</script>

<template>
  <view class="immersive-nav" :style="navigationStyle">
    <button
      v-if="props.showBack"
      class="immersive-nav__back"
      type="button"
      aria-label="返回上一页"
      @click="goBack"
    >
      <uni-icons type="left" size="28" color="#173553" />
    </button>
    <text class="immersive-nav__title">{{ props.title }}</text>
  </view>
</template>

<style scoped>
.immersive-nav {
  position: relative;
  z-index: 12;
  display: flex;
  width: 100%;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: transparent;
  color: #173553;
}

.immersive-nav__title {
  position: absolute;
  left: var(--immersive-nav-side-clearance);
  right: var(--immersive-nav-side-clearance);
  bottom: -16rpx;
  display: flex;
  height: 44px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 34rpx;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.immersive-nav__back {
  position: absolute;
  left: 24rpx;
  bottom: -16rpx;
  z-index: 1;
  display: inline-flex;
  width: 80rpx;
  height: 44px;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: flex-start;
  border: 0;
  background: transparent;
  line-height: 1;
}

.immersive-nav__back::after {
  border: 0;
}

.immersive-nav__back:active {
  opacity: 0.65;
}
</style>
