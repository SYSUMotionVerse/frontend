<script setup lang="ts">
defineProps<{
  title: string
  completedCount: number
  totalCount: number
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
        <text class="quest-panel__kicker">TODAY'S QUEST</text>
        <text class="quest-panel__title">{{ title }}</text>
      </view>
      <view class="quest-panel__meter">
        <text>{{ completedCount }} / {{ totalCount }} 已完成</text>
      </view>
    </view>

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
          <view v-if="quest.highlight" class="quest-panel__item-kicker-row">
            <text class="quest-panel__item-kicker">当前主线</text>
            <text class="quest-panel__item-cta">继续推进</text>
          </view>

          <view class="quest-panel__item-row">
            <text class="quest-panel__item-title">{{ quest.title }}</text>
            <text v-if="quest.highlight" class="quest-panel__item-status">EPIC</text>
            <text v-else-if="quest.completed" class="quest-panel__item-status quest-panel__item-status--done">DONE</text>
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
  gap: 12rpx;
}

.quest-panel__kicker {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8rpx 16rpx;
  border-radius: 9999px;
  background: rgba(255, 236, 199, 0.32);
  color: #c69021;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.quest-panel__title {
  display: block;
  color: #203042;
  font-size: 52rpx;
  line-height: 1.06;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.quest-panel__meter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52rpx;
  padding: 10rpx 20rpx;
  border-radius: 9999px;
  background: rgba(168, 230, 207, 0.2);
  color: #3f8b68;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.quest-panel__list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.quest-panel__item {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 26rpx 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 16rpx 28rpx rgba(37, 47, 61, 0.05),
    0 8rpx 0 rgba(245, 236, 218, 0.86);
}

.quest-panel__item--done {
  background: rgba(255, 255, 255, 0.72);
  opacity: 0.7;
}

.quest-panel__item--highlight {
  padding: 30rpx 26rpx;
  border: 4rpx solid rgba(255, 139, 139, 0.9);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 245, 245, 0.98) 100%);
  box-shadow:
    0 18rpx 30rpx rgba(255, 126, 134, 0.12),
    0 8rpx 0 rgba(250, 221, 221, 0.92);
  transform: scale(1.01);
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

.quest-panel__item-kicker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.quest-panel__item-kicker {
  display: inline-flex;
  min-height: 38rpx;
  align-items: center;
  justify-content: center;
  padding: 8rpx 14rpx;
  border-radius: 9999px;
  background: rgba(255, 139, 139, 0.18);
  color: #ff7e86;
  font-size: 16rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.quest-panel__item-cta {
  display: block;
  color: #ff7e86;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
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
  font-size: 28rpx;
  line-height: 1.24;
  font-weight: 900;
}

.quest-panel__item-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-height: 38rpx;
  padding: 8rpx 14rpx;
  border-radius: 9999px;
  background: rgba(255, 139, 139, 0.16);
  color: #ff7e86;
  font-size: 16rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
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
