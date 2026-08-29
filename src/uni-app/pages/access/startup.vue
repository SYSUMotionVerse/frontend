<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  studentBackendSync,
  type BootstrapAccessResult
} from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import ImmersiveNavigationBar from '../../components/layout/ImmersiveNavigationBar.vue'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'

const retryLimit = 2
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('连接失败，请稍后重试。')

onMounted(() => {
  void bootstrapAndRoute()
})

function resolveTargetPageUrl(result: BootstrapAccessResult) {
  if (result.targetPageUrl) {
    return result.targetPageUrl
  }

  if (result.targetPage === 'register') {
    return '/pages/access/register'
  }

  if (result.targetPage === 'questionnaire') {
    return `/pages/access/questionnaire?checkpoint=${result.checkpoint ?? 'baseline'}`
  }

  if (result.targetPage === 'home') {
    return '/pages/training/home'
  }

  return ''
}

async function bootstrapAndRoute() {
  isLoading.value = true
  hasError.value = false

  for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
    try {
      const result = await studentBackendSync.bootstrapAccess()
      const targetPageUrl = resolveTargetPageUrl(result)

      if (!targetPageUrl) {
        throw new Error('bootstrapAccess did not return a target page.')
      }

      await uni.reLaunch({
        url: targetPageUrl
      })
      return
    } catch (error) {
      if (attempt === retryLimit) {
        reportBackendSyncError('启动分流', error)
        hasError.value = true
        errorMessage.value = '连接失败，请点击重试。'
      }
    }
  }

  isLoading.value = false
}

function handleRetry() {
  void bootstrapAndRoute()
}

</script>

<template>
  <view class="startup-page">
    <view class="startup-page__halo startup-page__halo--coral" />
    <view class="startup-page__halo startup-page__halo--gold" />
    <view class="startup-page__halo startup-page__halo--teal" />
    <ImmersiveNavigationBar title="运动零食" />
    <view class="startup-page__content">
      <view class="startup-page__brand">
        <view class="startup-page__brand-mark" aria-hidden="true">
          <uni-icons type="fire-filled" size="42" color="#fffaf4" />
        </view>
        <text class="startup-page__eyebrow">SPORT SNACK</text>
        <text class="startup-page__title">每天一点，动出好状态</text>
        <text class="startup-page__subtitle">把训练变成轻松、持续的小习惯。</text>
      </view>

      <view v-if="isLoading" class="startup-page__status" aria-live="polite">
        <view class="startup-page__status-icon startup-page__status-icon--loading" aria-hidden="true">
          <uni-icons type="spinner-cycle" size="24" color="#ff6f62" />
        </view>
        <view class="startup-page__status-copy">
          <text class="startup-page__status-title">正在准备今日训练</text>
          <text class="startup-page__status-detail">同步你的计划与成长记录，请稍候…</text>
        </view>
      </view>
      <view v-else-if="hasError" class="startup-page__status startup-page__status--error" aria-live="assertive">
        <view class="startup-page__status-icon" aria-hidden="true">
          <uni-icons type="info-filled" size="24" color="#c76b5b" />
        </view>
        <view class="startup-page__status-copy">
          <text class="startup-page__status-title">暂时没连上服务</text>
          <text class="startup-page__status-detail">{{ errorMessage }} 你的训练记录不会丢失。</text>
        </view>
        <button class="startup-page__retry retry-button" @click="handleRetry">
          重新连接
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.startup-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background-color: #fcf7f0;
  color: #203042;
}

.startup-page__halo {
  position: fixed;
  z-index: 0;
  border-radius: 9999px;
  pointer-events: none;
}

.startup-page__halo--coral {
  top: -90rpx;
  right: -74rpx;
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 139, 139, 0.17);
}

.startup-page__halo--gold {
  left: -88rpx;
  top: 48vh;
  width: 210rpx;
  height: 210rpx;
  background: rgba(255, 211, 132, 0.16);
}

.startup-page__halo--teal {
  right: -92rpx;
  bottom: 100rpx;
  width: 190rpx;
  height: 190rpx;
  background: rgba(137, 207, 255, 0.12);
}

.startup-page__content {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: 80rpx;
  padding: 112rpx 48rpx calc(104rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.startup-page__brand {
  display: flex;
  align-items: center;
  flex-direction: column;
  text-align: center;
}

.startup-page__brand-mark {
  display: inline-flex;
  width: 132rpx;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  border: 10rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 42rpx;
  background: #ff7a75;
  box-shadow: 0 18rpx 36rpx rgba(196, 91, 84, 0.16);
}

.startup-page__eyebrow {
  margin-top: 32rpx;
  color: #c76b5b;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.startup-page__title {
  margin-top: 18rpx;
  color: #203042;
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.startup-page__subtitle {
  margin-top: 16rpx;
  color: #718096;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1.55;
}

.startup-page__status {
  display: flex;
  width: 100%;
  max-width: 620rpx;
  align-items: center;
  align-self: center;
  gap: 22rpx;
  padding: 28rpx 30rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.34);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14rpx 32rpx rgba(71, 56, 39, 0.07);
  box-sizing: border-box;
}

.startup-page__status--error {
  flex-wrap: wrap;
  border-color: rgba(199, 107, 91, 0.24);
}

.startup-page__status-icon {
  display: inline-flex;
  width: 68rpx;
  height: 68rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: #ffe8e5;
}

.startup-page__status-icon--loading {
  animation: startup-spin 1.15s linear infinite;
}

.startup-page__status-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}

.startup-page__status-title,
.startup-page__status-detail {
  display: block;
}

.startup-page__status-title {
  color: #203042;
  font-size: 27rpx;
  font-weight: 900;
}

.startup-page__status-detail {
  color: #718096;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
}

.startup-page__retry {
  width: 100%;
  min-height: 84rpx;
  margin-top: 4rpx;
  border: 0;
  border-radius: 9999px;
  background: #ff6f77;
  color: #fffaf4;
  font-size: 28rpx;
  font-weight: 900;
}

.startup-page__retry::after {
  border: 0;
}

@keyframes startup-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
