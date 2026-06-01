<script setup lang="ts">
type DockTab = 'home' | 'playground' | 'growth'
type DockIcon = 'home' | 'spark' | 'sprout'

const props = defineProps<{
  activeTab: DockTab
}>()

const dockItems: Array<{
  key: DockTab
  label: string
  icon: DockIcon
  url: string
}> = [
  {
    key: 'home',
    label: '首页',
    icon: 'home',
    url: '/pages/training/home'
  },
  {
    key: 'playground',
    label: '游乐场',
    icon: 'spark',
    url: '/pages/training/select'
  },
  {
    key: 'growth',
    label: '成长',
    icon: 'sprout',
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
          <view class="floating-dock__glyph" :class="`floating-dock__glyph--${item.icon}`">
            <template v-if="item.icon === 'home'">
              <view class="floating-dock__home-roof" />
              <view class="floating-dock__home-body" />
            </template>

            <template v-else-if="item.icon === 'spark'">
              <view class="floating-dock__spark-core" />
              <view class="floating-dock__spark-star" />
            </template>

            <template v-else>
              <view class="floating-dock__sprout-stem" />
              <view class="floating-dock__sprout-leaf floating-dock__sprout-leaf--left" />
              <view class="floating-dock__sprout-leaf floating-dock__sprout-leaf--right" />
            </template>
          </view>
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
          <view class="floating-dock__glyph" :class="`floating-dock__glyph--${item.icon}`">
            <template v-if="item.icon === 'home'">
              <view class="floating-dock__home-roof" />
              <view class="floating-dock__home-body" />
            </template>

            <template v-else-if="item.icon === 'spark'">
              <view class="floating-dock__spark-core" />
              <view class="floating-dock__spark-star" />
            </template>

            <template v-else>
              <view class="floating-dock__sprout-stem" />
              <view class="floating-dock__sprout-leaf floating-dock__sprout-leaf--left" />
              <view class="floating-dock__sprout-leaf floating-dock__sprout-leaf--right" />
            </template>
          </view>
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
  background: rgba(255, 250, 244, 0.96);
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
  text-decoration: none;
}

.floating-dock__item--active {
  flex-direction: column;
  gap: 10rpx;
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
  background: rgba(221, 235, 247, 0.92);
  color: #7f95b2;
}

.floating-dock__icon--active {
  width: 96rpx;
  height: 96rpx;
  background: linear-gradient(135deg, #ff8088, #ff9ba0);
  color: #ffffff;
  box-shadow: 0 14rpx 0 rgba(231, 215, 204, 0.9);
}

.floating-dock__glyph {
  position: relative;
  width: 34rpx;
  height: 34rpx;
}

.floating-dock__glyph--home {
  width: 36rpx;
  height: 34rpx;
}

.floating-dock__home-roof {
  position: absolute;
  left: 4rpx;
  top: 2rpx;
  width: 28rpx;
  height: 18rpx;
  background: currentColor;
  clip-path: polygon(50% 0, 100% 58%, 82% 58%, 82% 100%, 18% 100%, 18% 58%, 0 58%);
}

.floating-dock__home-body {
  position: absolute;
  left: 10rpx;
  bottom: 2rpx;
  width: 16rpx;
  height: 14rpx;
  border-radius: 4rpx;
  background: currentColor;
}

.floating-dock__spark-core {
  position: absolute;
  inset: 4rpx;
  border-radius: 9999px;
  background: currentColor;
}

.floating-dock__spark-core::after {
  position: absolute;
  inset: 8rpx;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  content: '';
}

.floating-dock__spark-star {
  position: absolute;
  right: -1rpx;
  top: -2rpx;
  width: 12rpx;
  height: 12rpx;
  background: currentColor;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
}

.floating-dock__sprout-stem {
  position: absolute;
  left: 16rpx;
  bottom: 3rpx;
  width: 4rpx;
  height: 22rpx;
  border-radius: 9999px;
  background: currentColor;
}

.floating-dock__sprout-leaf {
  position: absolute;
  top: 4rpx;
  width: 16rpx;
  height: 20rpx;
  border-radius: 16rpx 16rpx 16rpx 0;
  background: currentColor;
}

.floating-dock__sprout-leaf--left {
  left: 2rpx;
  transform: rotate(-34deg);
}

.floating-dock__sprout-leaf--right {
  right: 2rpx;
  transform: scaleX(-1) rotate(-34deg);
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
