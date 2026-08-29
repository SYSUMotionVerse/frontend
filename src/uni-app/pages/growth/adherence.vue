<script setup lang="ts">
import { computed } from 'vue'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import GrowthLoadStatus from '../../../components/growth/GrowthLoadStatus.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'

const { adherenceCalendar, adherenceData, loadState, refresh } = useGrowthOverview({
  sections: ['adherence']
})
const complianceLoaded = computed(() => adherenceData.value !== null)
const complianceTodayCount = computed(() => {
  const todayCount = adherenceData.value?.todayCount ?? 0
  return Math.min(3, Math.max(0, todayCount))
})
const complianceRatePercent = computed(() =>
  Math.round((adherenceData.value?.complianceRate ?? 0) * 100)
)
const complianceTrend = computed(() => adherenceData.value?.trend.slice(-8) ?? [])

</script>

<template>
  <UniGrowthPageShell :show-dock="false" page-title="坚持情况" show-back>
    <UniPageHeading
      eyebrow="成长"
      title="达标记录"
      description="训练坚持记录与依从性分析。"
    />

    <GrowthLoadStatus
      :status="loadState.status"
      :message="loadState.message"
      @retry="refresh({ force: true })"
    />

    <section v-if="complianceLoaded" class="detail-page__stats">
      <view class="stat-item">
        <span class="stat-value">{{ complianceTodayCount }}/3</span>
        <span class="stat-label">今日打卡</span>
      </view>
      <view class="stat-item">
        <span class="stat-value" :class="{ 'stat-value--done': adherenceData?.todayCompleted }">
          {{ adherenceData?.todayCompleted ? '✓' : '—' }}
        </span>
        <span class="stat-label">今日达标</span>
      </view>
      <view class="stat-item">
        <span class="stat-value">{{ adherenceData?.completedDays }}</span>
        <span class="stat-label">累计达标天</span>
      </view>
      <view class="stat-item">
        <span class="stat-value">{{ complianceRatePercent }}%</span>
        <span class="stat-label">达标日/有训练日</span>
      </view>
    </section>

    <section v-if="complianceLoaded && complianceTrend.length > 0" class="detail-page__card">
      <h2 class="detail-page__section-title">周达标日/有训练日</h2>
      <view class="trend-bars">
        <view v-for="item in complianceTrend" :key="item.period" class="trend-bar-item">
          <view class="trend-bar-track">
            <view
              class="trend-bar-fill"
              :style="{ height: Math.round(item.completionRate * 100) + '%' }"
            />
          </view>
          <span class="trend-bar-label">{{ item.label.slice(-2) }}</span>
        </view>
      </view>
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__section-title">近期热力图</h2>
      <AdherenceHeatmap :days="adherenceCalendar" />
      <p class="detail-page__note">每个方块代表一天，训练次数越多颜色越深，3 次即达标。</p>
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__section-title { margin: 0 0 20rpx; color: #203042; font-size: 32rpx; }

.detail-page__card {
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 28rpx;
  padding: 32rpx;
  background: rgba(255, 255, 255, 0.94);
  margin-bottom: 28rpx;
}

.detail-page__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 28rpx;
}
.stat-item {
  flex: 1 1 140rpx;
  background: rgba(255, 255, 255, 0.78);
  border: 2rpx solid rgba(137, 207, 255, 0.2);
  border-radius: 20rpx;
  padding: 20rpx 12rpx;
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #1d366b;
}
.stat-value--done {
  color: #22c55e;
  font-size: 38rpx;
}
.stat-label {
  display: block;
  font-size: 24rpx;
  color: #718096;
  margin-top: 6rpx;
}

.trend-bars {
  display: flex;
  gap: 8rpx;
  align-items: flex-end;
  height: 120rpx;
}
.trend-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.trend-bar-track {
  width: 100%;
  height: 90rpx;
  background: #f1f5f9;
  border-radius: 6rpx;
  position: relative;
  display: flex;
  align-items: flex-end;
}
.trend-bar-fill {
  width: 100%;
  background: #FF8B8B;
  border-radius: 6rpx;
  min-height: 4rpx;
}
.trend-bar-label {
  font-size: 22rpx;
  color: #8899b4;
}

.detail-page__note { margin: 20rpx 0 0; color: #718096; font-size: 22rpx; line-height: 1.5; }
</style>
