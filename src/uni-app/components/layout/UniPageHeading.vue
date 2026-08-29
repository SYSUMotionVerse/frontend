<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description?: string
  inset?: boolean
}>(), {
  eyebrow: '',
  description: '',
  inset: false
})
</script>

<template>
  <view class="page-heading" :class="{ 'page-heading--inset': inset }">
    <text v-if="eyebrow" class="page-heading__eyebrow">{{ eyebrow }}</text>
    <text class="page-heading__title">{{ title }}</text>
    <text v-if="description" class="page-heading__description">{{ description }}</text>
  </view>
</template>

<style scoped>
.page-heading {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.page-heading--inset {
  margin-top: 24rpx;
  margin-left: 32rpx;
}

.page-heading__eyebrow {
  color: #c76b5b;
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.page-heading__title {
  color: #203042;
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.page-heading__description {
  max-width: 620rpx;
  color: #718096;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.55;
}
</style>
