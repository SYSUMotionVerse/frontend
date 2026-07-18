<script setup lang="ts">
import AchievementBadgeList from '../../../components/growth/AchievementBadgeList.vue'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import AssessmentHistoryList from '../../../components/growth/AssessmentHistoryList.vue'
import GrowthSummaryCards from '../../../components/growth/GrowthSummaryCards.vue'
import PhysicalMetricsPanel from '../../../components/growth/PhysicalMetricsPanel.vue'
import SessionBadgeList from '../../../components/growth/SessionBadgeList.vue'
import TrainingHistoryList from '../../../components/growth/TrainingHistoryList.vue'
import VisualScoreTrendPanel from '../../../components/growth/VisualScoreTrendPanel.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'

const {
  achievements,
  adherenceCalendar,
  assessments,
  latestAssessment,
  physicalMetricsState,
  scoreTrend,
  sessionBadges,
  sessions,
  summaryCards
} = useGrowthOverview()

function openDetailPage(page: 'adherence' | 'achievements' | 'metrics' | 'history') {
  void uni.navigateTo({
    url: `/pages/growth/${page}`
  })
}
</script>

<template>
  <UniGrowthPageShell dock-tab="growth">
    <view class="growth-page__header">
      <view class="growth-page__eyebrow">
        <text>成长乐园</text>
      </view>
      <text class="growth-page__title">成长中心</text>
      <text class="growth-page__subtitle">
        跟踪你的训练坚持度、评估和成就。
      </text>
      <text class="growth-page__link growth-page__link--current">当前页面</text>
    </view>

    <GrowthSummaryCards
      :cards="summaryCards"
      :latest-assessment="latestAssessment"
    />

    <view class="growth-page__section growth-page__section-shell">
      <view class="growth-page__section-head">
        <text class="growth-page__section-title">达标日历</text>
        <button class="growth-page__link" type="button" @click="openDetailPage('adherence')">
          <text>查看详情</text>
        </button>
      </view>
      <AdherenceHeatmap :days="adherenceCalendar" />
      <SessionBadgeList :badges="sessionBadges" />
    </view>

    <view class="growth-page__section growth-page__section-shell">
      <view class="growth-page__section-head">
        <text class="growth-page__section-title">成就</text>
        <button class="growth-page__link" type="button" @click="openDetailPage('achievements')">
          <text>查看详情</text>
        </button>
      </view>
      <AchievementBadgeList :achievements="achievements" />
    </view>

    <view class="growth-page__section growth-page__section-shell">
      <view class="growth-page__section-head">
        <text class="growth-page__section-title">体能指标</text>
        <button class="growth-page__link" type="button" @click="openDetailPage('metrics')">
          <text>查看详情</text>
        </button>
      </view>
      <PhysicalMetricsPanel :metrics-state="physicalMetricsState" />
    </view>

    <view class="growth-page__section growth-page__section-shell">
      <view class="growth-page__section-head">
        <text class="growth-page__section-title">视觉得分趋势</text>
      </view>
      <VisualScoreTrendPanel :score-trend="scoreTrend" />
    </view>

    <view class="growth-page__section growth-page__section-shell">
      <view class="growth-page__section-head">
        <text class="growth-page__section-title">历史记录</text>
        <button class="growth-page__link" type="button" @click="openDetailPage('history')">
          <text>查看详情</text>
        </button>
      </view>
      <text class="growth-page__subtitle">查看训练与问卷历史。</text>
      <TrainingHistoryList :sessions="sessions" />
      <AssessmentHistoryList :assessments="assessments" />
    </view>
  </UniGrowthPageShell>
</template>

<style scoped>
.growth-page__header {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.growth-page__eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 12rpx 24rpx;
  border-radius: 9999px;
  border: 4rpx solid rgba(255, 211, 132, 0.24);
  background: rgba(255, 211, 132, 0.16);
  color: #D97706;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.growth-page__title {
  display: block;
  margin: 0;
  font-size: 72rpx;
  font-weight: 900;
  color: #1A202C;
  letter-spacing: -0.03em;
}

.growth-page__subtitle {
  display: block;
  margin: 0;
  color: #64748B;
  font-size: 34rpx;
  line-height: 1.5;
  font-weight: 700;
}

.growth-page__section {
  padding: 40rpx;
}

.growth-page__section-shell {
  border: 8rpx solid rgba(255, 211, 132, 0.24);
  border-radius: 48rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12rpx 0 rgba(0, 0, 0, 0.05);
}

.growth-page__section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.growth-page__section-title {
  display: block;
  margin: 0;
  font-size: 38rpx;
  font-weight: 900;
  color: #1A202C;
}

.growth-page__link {
  color: #2B7CB8;
  font-size: 24rpx;
  font-weight: 900;
  text-decoration: none;
  border-radius: 9999px;
  padding: 12rpx 24rpx;
  border: 4rpx solid rgba(137, 207, 255, 0.24);
  background: rgba(137, 207, 255, 0.12);
  border: none;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
  min-height: 0;
  line-height: normal;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.growth-page__link::after {
  display: none;
}

.growth-page__link--current {
  display: inline-block;
  width: fit-content;
  color: #065F46;
  border-color: rgba(168, 230, 207, 0.3);
  background: rgba(168, 230, 207, 0.22);
  width: fit-content;
}

.growth-page__link:active {
  color: #1A202C;
  background: rgba(255, 211, 132, 0.16);
  transform: scale(0.98);
}
</style>
