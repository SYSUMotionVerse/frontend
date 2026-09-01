<script setup lang="ts">
defineProps<{
  instructions: string
  legendItems: Array<{
    key: string
    label: string
  }>
}>()
</script>

<template>
  <view class="questionnaire-instructions">
    <text class="questionnaire-instructions__title">作答说明</text>
    <text class="questionnaire-instructions__copy">{{ instructions }}</text>
    <view v-if="legendItems.length" class="questionnaire-instructions__legend" aria-label="作答图例">
      <view
        v-for="item in legendItems"
        :key="`${item.key}-${item.label}`"
        class="questionnaire-instructions__legend-item"
      >
        <text class="questionnaire-instructions__legend-key">{{ item.key }}</text>
        <text>={{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.questionnaire-instructions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx 26rpx;
  border: 2rpx solid rgba(137, 207, 255, 0.2);
  border-radius: 24rpx;
  background: rgba(248, 250, 252, 0.94);
  color: #536176;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.55;
}

.questionnaire-instructions__title {
  color: #1a202c;
  font-size: 27rpx;
  font-weight: 900;
}

.questionnaire-instructions__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 20rpx;
  padding-top: 4rpx;
}

.questionnaire-instructions__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  white-space: nowrap;
}

.questionnaire-instructions__legend-key {
  display: inline-flex;
  width: 36rpx;
  height: 36rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(255, 139, 139, 0.34);
  border-radius: 50%;
  color: #c35f6b;
  font-size: 19rpx;
  font-weight: 900;
}
</style>
