<script setup lang="ts">
import { computed } from 'vue'
import AchievementBadgeList from '../../../components/growth/AchievementBadgeList.vue'
import { buildGrowthSummary } from '../../../domain/student/growth'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const summary = computed(() => buildGrowthSummary(store.getSnapshot()))
const earnedCount = computed(() => summary.value.achievements.filter((badge) => badge.earned).length)
</script>

<template>
  <UniGrowthPageShell dock-tab="growth">
    <view class="achievement-page__hero-card">
      <view class="achievement-page__eyebrow">
        <text>奖杯陈列室</text>
      </view>
      <view class="achievement-page__medal-sticker">
        <text>🏆</text>
      </view>
      <text class="achievement-page__title">成就详情</text>
      <text class="achievement-page__subtitle">基于参与和坚持的激励里程碑。</text>
      <view class="achievement-page__summary-pill">
        <text>{{ earnedCount }} / {{ summary.achievements.length }} 已解锁</text>
      </view>
    </view>

    <view class="achievement-page__hero-card achievement-page__board-card">
      <AchievementBadgeList :achievements="summary.achievements" />
    </view>
  </UniGrowthPageShell>
</template>

<style scoped>
.achievement-page__hero-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  overflow: hidden;
  border: 8rpx solid rgba(255, 211, 132, 0.26);
  border-radius: 48rpx;
  background: rgba(255, 255, 255, 0.94);
  padding: 36rpx;
  box-shadow: 0 12rpx 0 rgba(0, 0, 0, 0.05);
}

.achievement-page__eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 12rpx 24rpx;
  border-radius: 9999px;
  border: 4rpx solid rgba(137, 207, 255, 0.26);
  background: rgba(137, 207, 255, 0.14);
  color: #2B7CB8;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.achievement-page__medal-sticker {
  position: absolute;
  top: 28rpx;
  right: 28rpx;
  display: inline-flex;
  width: 120rpx;
  height: 120rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 6rpx solid #ffffff;
  background: rgba(255, 211, 132, 0.9);
  box-shadow: 0 12rpx 0 rgba(255, 211, 132, 0.28);
  font-size: 56rpx;
}

.achievement-page__title {
  display: block;
  margin: 0;
  color: #1A202C;
  font-size: 64rpx;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.achievement-page__subtitle {
  display: block;
  max-width: 560rpx;
  margin: 0;
  color: #64748B;
  font-size: 32rpx;
  line-height: 1.55;
  font-weight: 700;
}

.achievement-page__summary-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 12rpx 24rpx;
  border-radius: 9999px;
  background: rgba(168, 230, 207, 0.22);
  color: #065F46;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.achievement-page__board-card {
  gap: 0;
}
</style>
