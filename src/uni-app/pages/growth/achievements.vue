<script setup lang="ts">
import { computed } from 'vue'
import AchievementBadgeList from '../../../components/growth/AchievementBadgeList.vue'
import GrowthLoadStatus from '../../../components/growth/GrowthLoadStatus.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'

const { achievements, loadState, refresh } = useGrowthOverview({
  sections: ['awards']
})
const earnedCount = computed(() => achievements.value.filter(badge => badge.earned).length)
</script>

<template>
  <UniGrowthPageShell dock-tab="growth">
    <view class="achievement-page__heading">
      <UniPageHeading
        eyebrow="成长"
        title="成就"
        description="基于参与和坚持的激励里程碑。"
      />
      <text class="achievement-page__summary">{{ earnedCount }} / {{ achievements.length }} 已解锁</text>
    </view>

    <GrowthLoadStatus
      :status="loadState.status"
      :message="loadState.message"
      @retry="refresh({ force: true })"
    />

    <view class="achievement-page__board">
      <AchievementBadgeList :achievements="achievements" />
    </view>
  </UniGrowthPageShell>
</template>

<style scoped>
.achievement-page__heading,
.achievement-page__board {
  display: flex;
  flex-direction: column;
}

.achievement-page__heading {
  gap: 18rpx;
}

.achievement-page__summary {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8rpx 16rpx;
  border-radius: 9999px;
  background: rgba(168, 230, 207, 0.22);
  color: #21685c;
  font-size: 22rpx;
  font-weight: 800;
}

.achievement-page__board {
  padding: 32rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
}
</style>
