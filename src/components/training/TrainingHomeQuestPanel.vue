<script setup lang="ts">
defineProps<{
  title: string
  completedCount: number
  totalCount: number
  weekQualifyingDayCount: number
  quests: Array<{
    id: string
    title: string
    detail: string
    completed: boolean
    highlight: boolean
  }>
}>()
</script>

<template>
  <view class="quest-panel">
    <view class="quest-panel__head">
      <view class="quest-panel__head-copy">
        <text class="quest-panel__title">{{ title }}</text>
      </view>
      <view class="quest-panel__meter">
        <text>{{ completedCount }} / {{ totalCount }}</text>
      </view>
    </view>

    <text class="quest-panel__weekly-summary">本周已达标 {{ weekQualifyingDayCount }} 天</text>

    <view class="quest-panel__list">
      <view
        v-for="quest in quests"
        :key="quest.id"
        class="quest-panel__item"
        :class="{
          'quest-panel__item--done': quest.completed,
          'quest-panel__item--highlight': quest.highlight
        }"
      >
        <view class="quest-panel__check" :class="{ 'quest-panel__check--done': quest.completed }">
          <text>{{ quest.completed ? '✓' : '' }}</text>
        </view>

        <view class="quest-panel__copy">
          <view class="quest-panel__item-row">
            <text class="quest-panel__item-title">{{ quest.title }}</text>
            <text v-if="quest.highlight && !quest.completed" class="quest-panel__item-status">进行中</text>
            <text v-else-if="quest.completed" class="quest-panel__item-status quest-panel__item-status--done">已完成</text>
          </view>
          <text class="quest-panel__item-detail">{{ quest.detail }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.quest-panel {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.quest-panel__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.quest-panel__head-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0;
}

.quest-panel__title {
  display: block;
  color: #203042;
  font-size: 40rpx;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.quest-panel__meter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 8rpx 16rpx;
  border-radius: 16rpx;
  background: rgba(168, 230, 207, 0.24);
  color: #3f8b68;
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: 800;
}

.quest-panel__list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.quest-panel__weekly-summary {
  display: block;
  margin-top: -10rpx;
  color: #7b8798;
  font-size: 20rpx;
  line-height: 1.4;
  font-weight: 600;
}

.quest-panel__item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 24rpx;
  border: 2rpx solid rgba(123, 135, 152, 0.12);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.94);
}

.quest-panel__item--done {
  background: rgba(255, 255, 255, 0.72);
  opacity: 0.7;
}

.quest-panel__item--highlight {
  border-color: rgba(255, 139, 139, 0.6);
  background: rgba(255, 245, 245, 0.98);
}

.quest-panel__check {
  display: inline-flex;
  width: 36rpx;
  height: 36rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 4rpx solid rgba(255, 139, 139, 0.3);
  background: #ffffff;
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 900;
}

.quest-panel__check--done {
  border-color: rgba(168, 230, 207, 0.28);
  background: rgba(168, 230, 207, 0.84);
  color: #ffffff;
}

.quest-panel__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.quest-panel__item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.quest-panel__item-title {
  display: block;
  color: #243244;
  font-size: 26rpx;
  line-height: 1.24;
  font-weight: 900;
}

.quest-panel__item-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-height: 34rpx;
  padding: 6rpx 10rpx;
  border-radius: 12rpx;
  background: rgba(255, 139, 139, 0.16);
  color: #ff7e86;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
}

.quest-panel__item-status--done {
  background: rgba(168, 230, 207, 0.24);
  color: #5c9e78;
}

.quest-panel__item-detail {
  display: block;
  color: #8a97a8;
  font-size: 20rpx;
  line-height: 1.45;
  font-weight: 700;
}
</style>
