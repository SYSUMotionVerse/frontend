<script setup lang="ts">
import { shallowRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  instructions: string
  legendItems: Array<{
    key: string
    label: string
  }>
  collapsible?: boolean
  defaultExpanded?: boolean
}>(), {
  collapsible: false,
  defaultExpanded: true
})

const expanded = shallowRef(!props.collapsible || props.defaultExpanded)

watch(
  () => [props.collapsible, props.defaultExpanded] as const,
  ([collapsible, defaultExpanded]) => {
    expanded.value = !collapsible || defaultExpanded
  }
)

function toggleInstructions() {
  if (!props.collapsible) return
  expanded.value = !expanded.value
}
</script>

<template>
  <view class="questionnaire-instructions">
    <view class="questionnaire-instructions__header">
      <text class="questionnaire-instructions__title">作答说明</text>
      <button
        v-if="collapsible"
        class="questionnaire-instructions__toggle"
        type="button"
        :aria-expanded="expanded"
        aria-label="查看作答说明"
        @click="toggleInstructions"
      >
        ?
      </button>
    </view>
    <text v-if="expanded" class="questionnaire-instructions__copy">{{ instructions }}</text>
    <view v-if="expanded && legendItems.length" class="questionnaire-instructions__legend" aria-label="作答图例">
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

.questionnaire-instructions__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.questionnaire-instructions__toggle {
  display: inline-flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 48rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 2rpx solid rgba(255, 139, 139, 0.4);
  border-radius: 50%;
  background: #fff;
  color: #c35f6b;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 48rpx;
}

.questionnaire-instructions__toggle::after {
  border: none;
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
