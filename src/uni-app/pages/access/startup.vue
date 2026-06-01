<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'

type BootstrapAccessResult = {
  targetPageUrl?: string
  targetPage?: 'register' | 'baselineQuestionnaire' | 'home'
}

type StudentBackendSyncWithBootstrap = typeof studentBackendSync & {
  bootstrapAccess: () => Promise<BootstrapAccessResult>
}

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

  if (result.targetPage === 'baselineQuestionnaire') {
    return '/pages/access/questionnaire?checkpoint=baseline'
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
      const result = await (studentBackendSync as StudentBackendSyncWithBootstrap).bootstrapAccess()
      const targetPageUrl = resolveTargetPageUrl(result)

      if (!targetPageUrl) {
        throw new Error('bootstrapAccess did not return a target page.')
      }

      void uni.reLaunch({
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
    <view v-if="isLoading" class="startup-page__message">
      正在连接服务并校验账号状态...
    </view>
    <view v-else-if="hasError" class="startup-page__error">
      <text class="startup-page__error-text">{{ errorMessage }}</text>
      <button class="retry-button" @click="handleRetry">
        重试
      </button>
    </view>
  </view>
</template>

<style scoped>
.startup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
  background-color: #fcf7f0;
}

.startup-page__message,
.startup-page__error {
  width: 100%;
  max-width: 560rpx;
  border-radius: 24rpx;
  background: #ffffff;
  padding: 32rpx;
  text-align: center;
  color: #475569;
  font-size: 28rpx;
  line-height: 1.6;
}

.startup-page__error-text {
  display: block;
  margin-bottom: 24rpx;
}

.retry-button {
  width: 100%;
  font-size: 28rpx;
}
</style>
