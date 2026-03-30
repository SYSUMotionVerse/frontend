<script setup lang="ts">
type DockTab = 'home' | 'playground' | 'growth'

const props = defineProps<{
  activeTab: DockTab
}>()

const dockItems: Array<{
  key: DockTab
  label: string
  shortLabel: string
  url: string
}> = [
  {
    key: 'home',
    label: '首页',
    shortLabel: '家',
    url: '/pages/training/home'
  },
  {
    key: 'playground',
    label: '游乐场',
    shortLabel: '玩',
    url: '/pages/training/select'
  },
  {
    key: 'growth',
    label: '成长',
    shortLabel: '长',
    url: '/pages/growth/index'
  }
]
</script>

<template>
  <view class="floating-dock">
    <block v-for="item in dockItems" :key="item.key">
      <view
        v-if="item.key === props.activeTab"
        class="floating-dock__item floating-dock__item--active"
      >
        <view class="floating-dock__icon floating-dock__icon--active">
          <text>{{ item.shortLabel }}</text>
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
          <text>{{ item.shortLabel }}</text>
        </view>
        <text class="floating-dock__label">{{ item.label }}</text>
      </navigator>
    </block>
  </view>
</template>

<style scoped>
.floating-dock {
  position: fixed;
  left: 32rpx;
  right: 32rpx;
  bottom: 28rpx;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 18rpx 24rpx;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 24rpx 42rpx rgba(37, 47, 61, 0.1),
    0 12rpx 0 rgba(244, 231, 208, 0.82);
}

.floating-dock__item {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 10rpx 8rpx;
  border-radius: 9999px;
}

.floating-dock__item--active {
  justify-content: flex-start;
}

.floating-dock__item--pressed {
  transform: translateY(2rpx);
}

.floating-dock__icon {
  display: inline-flex;
  width: 56rpx;
  height: 56rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(231, 237, 247, 0.92);
  color: #8c9db7;
  font-size: 24rpx;
  font-weight: 900;
}

.floating-dock__icon--active {
  width: 96rpx;
  height: 96rpx;
  background: linear-gradient(135deg, #ff8088, #ff9ba0);
  color: #ffffff;
  box-shadow: 0 14rpx 0 rgba(231, 215, 204, 0.9);
}

.floating-dock__label {
  display: block;
  color: #90a0ba;
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.floating-dock__label--active {
  color: #233244;
}
</style>
