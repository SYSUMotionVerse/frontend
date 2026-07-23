<script setup lang="ts">
defineProps<{
  status: 'loading' | 'ready' | 'partial' | 'error'
  message: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <view
    v-if="status !== 'ready'"
    :class="['growth-load-status', `growth-load-status--${status}`]"
    aria-live="polite"
  >
    <text class="growth-load-status__message">{{ message }}</text>
    <button
      v-if="status === 'partial' || status === 'error'"
      class="growth-load-status__retry"
      aria-label="重新加载成长记录"
      @click="emit('retry')"
    >
      重新加载
    </button>
  </view>
</template>

<style scoped>
.growth-load-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 88rpx;
  margin-bottom: 28rpx;
  padding: 16rpx 20rpx;
  border: 2rpx solid #d9e2ec;
  border-radius: 20rpx;
  background: #f8fafc;
}

.growth-load-status--partial,
.growth-load-status--error {
  border-color: rgba(199, 107, 91, 0.35);
  background: #fff7f5;
}

.growth-load-status__message {
  flex: 1;
  color: #526173;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
}

.growth-load-status__retry {
  display: inline-flex;
  min-width: 152rpx;
  min-height: 72rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 12rpx 20rpx;
  border: 0;
  border-radius: 9999px;
  background: #a64f42;
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1;
}

.growth-load-status__retry::after {
  display: none;
}
</style>
