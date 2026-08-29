<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, ref } from 'vue'
import { onShareAppMessage, onShow } from '@dcloudio/uni-app'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import GrowthLoadStatus from '../../../components/growth/GrowthLoadStatus.vue'
import SessionBadgeList from '../../../components/growth/SessionBadgeList.vue'
import TrainingHomeHeader from '../../../components/training/TrainingHomeHeader.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'
import { useStationNotifications } from '../../composables/useStationNotifications'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const stationNotifications = useStationNotifications()
const displayName = computed(() => store.state.profile.name.trim() || '同学')
const isRefreshing = ref(false)

const {
  achievements,
  adherenceCalendar,
  assessments,
  loadState,
  physicalMetricsState,
  refresh,
  sessionBadges,
  sessions,
  summaryCards
} = useGrowthOverview({
  sections: ['history', 'adherence', 'physicalMetrics', 'awards']
})

const earnedAchievementCount = computed(() =>
  achievements.value.filter(achievement => achievement.earned).length
)
const weeklyGoal = computed(() =>
  summaryCards.value.find(card => card.key === 'weekly-goal')
)
const complianceRate = computed(() =>
  summaryCards.value.find(card => card.key === 'current-streak')
)
const overviewStats = computed(() => [
  {
    label: weeklyGoal.value?.label ?? '本周达标',
    value: weeklyGoal.value?.value ?? '进行中',
    description: weeklyGoal.value?.description ?? '训练后会更新达标状态。',
    icon: 'heart-filled',
    tone: 'coral',
    iconColor: '#c76b5b'
  },
  {
    label: complianceRate.value?.label ?? '达标日/有训练日',
    value: complianceRate.value?.value ?? '暂无数据',
    description: '以有训练的日为分母计算。',
    icon: 'star-filled',
    tone: 'gold',
    iconColor: '#a76c1c'
  }
])
const explorationLinks = computed(() => [
  {
    url: '/pages/growth/achievements',
    title: '成就',
    meta: `${earnedAchievementCount.value} / ${achievements.value.length} 已解锁`,
    icon: 'medal-filled',
    tone: 'coral',
    iconColor: '#c76b5b'
  },
  {
    url: '/pages/growth/metrics',
    title: '体能指标',
    meta: physicalMetricsState.value.hasMetrics ? '已有数据' : '等待数据',
    icon: 'bars',
    tone: 'teal',
    iconColor: '#2b7cb8'
  },
  {
    url: '/pages/growth/history',
    title: '训练与评估历史',
    meta: `${sessions.value.length} 次训练 · ${assessments.value.length} 次评估`,
    icon: 'calendar-filled',
    tone: 'gold',
    iconColor: '#a76c1c'
  }
])

onShow(() => {
  void Promise.all([
    refresh(),
    stationNotifications.refresh()
  ])
})

async function handlePullDownRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      refresh({ force: true }),
      stationNotifications.refresh({ force: true })
    ])
  } finally {
    isRefreshing.value = false
  }
}

onShareAppMessage((options) => {
  const targetDataset = options.target?.dataset as {
    shareTitle?: string
    sharePath?: string
  } | undefined

  return {
    title: targetDataset?.shareTitle ?? '我的 Sport Snack 成长记录',
    path: targetDataset?.sharePath ?? '/pages/access/startup'
  }
})
</script>

<template>
  <UniGrowthPageShell
    dock-tab="growth"
    page-title="成长记录"
    refresh-enabled
    :refreshing="isRefreshing"
    @refresh="handlePullDownRefresh"
  >
    <view class="growth-page">
      <TrainingHomeHeader
        :display-name="displayName"
        reminder-label="成长记录持续更新"
        :unread-count="stationNotifications.unreadCount.value"
        :show-headline="false"
        :show-status="false"
        mini-tag="你的成长在持续记录"
        mini-tag-tone="muted"
        variant="home"
        @open-notifications="stationNotifications.openList"
      />

      <GrowthLoadStatus
        :status="loadState.status"
        :message="loadState.message"
        @retry="refresh({ force: true })"
      />

      <view class="growth-page__overview">
        <text class="growth-page__group-title">本周概览</text>

        <view class="growth-page__overview-stats" aria-label="本周成长摘要">
          <view
            v-for="stat in overviewStats"
            :key="stat.label"
            class="growth-page__overview-stat"
          >
            <view class="growth-page__overview-stat-head">
              <view :class="['growth-page__overview-stat-icon', `growth-page__overview-stat-icon--${stat.tone}`]">
                <uni-icons :type="stat.icon" size="15" :color="stat.iconColor" />
              </view>
              <text class="growth-page__overview-stat-label">{{ stat.label }}</text>
            </view>
            <text class="growth-page__overview-stat-value">{{ stat.value }}</text>
            <text class="growth-page__overview-stat-description">{{ stat.description }}</text>
          </view>
        </view>
      </view>

      <view class="growth-page__section growth-page__section-shell growth-page__section-shell--adherence">
        <view class="growth-page__section-head">
          <view class="growth-page__section-copy">
            <text class="growth-page__section-title">本周打卡记录</text>
          </view>
          <navigator class="growth-page__link" url="/pages/growth/adherence">查看详情</navigator>
        </view>
        <AdherenceHeatmap :days="adherenceCalendar" />
        <SessionBadgeList :badges="sessionBadges" />
      </view>

      <view class="growth-page__section growth-page__section-shell growth-page__section-shell--explore">
        <view class="growth-page__section-head">
          <view class="growth-page__section-copy">
            <text class="growth-page__section-title">完整记录</text>
          </view>
        </view>
        <view class="growth-page__exploration-list">
          <navigator
            v-for="link in explorationLinks"
            :key="link.url"
            class="growth-page__exploration-row"
            :url="link.url"
          >
            <view :class="['growth-page__exploration-icon', `growth-page__exploration-icon--${link.tone}`]">
              <uni-icons :type="link.icon" size="18" :color="link.iconColor" />
            </view>
            <view class="growth-page__exploration-copy">
              <text class="growth-page__exploration-title">{{ link.title }}</text>
              <text class="growth-page__exploration-meta">{{ link.meta }}</text>
            </view>
            <text class="growth-page__exploration-arrow">›</text>
          </navigator>
        </view>
      </view>
    </view>
  </UniGrowthPageShell>
</template>

<style scoped>
.growth-page,
.growth-page__overview,
.growth-page__overview-heading,
.growth-page__overview-copy,
.growth-page__overview-stats,
.growth-page__overview-stat,
.growth-page__overview-stat-head,
.growth-page__section-copy,
.growth-page__exploration-list,
.growth-page__exploration-row,
.growth-page__exploration-icon,
.growth-page__exploration-copy {
  display: flex;
}

.growth-page {
  --growth-space-1: 14rpx;
  --growth-space-2: 18rpx;
  --growth-space-3: 22rpx;
  --growth-space-4: 26rpx;
  flex-direction: column;
  gap: var(--growth-space-4);
  padding-bottom: 12rpx;
}

.growth-page__overview {
  flex-direction: column;
  gap: var(--growth-space-3);
}

.growth-page__overview-copy,
.growth-page__section-copy,
.growth-page__exploration-copy {
  flex-direction: column;
  gap: var(--growth-space-1);
}

.growth-page__group-title {
  color: #203042;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.2;
}

.growth-page__eyebrow {
  color: #c76b5b;
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.growth-page__overview-title {
  color: #203042;
  font-size: 40rpx;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.12;
}

.growth-page__overview-subtitle {
  max-width: 500rpx;
  color: #718096;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.growth-page__overview-stats {
  gap: 14rpx;
}

.growth-page__overview-stat {
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  padding: 22rpx 20rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.24);
  border-radius: 28rpx;
  background: rgba(255, 250, 244, 0.94);
  box-shadow: 0 8rpx 18rpx rgba(71, 56, 39, 0.035);
}

.growth-page__overview-stat + .growth-page__overview-stat {
  border-left-color: rgba(255, 211, 132, 0.24);
}

.growth-page__overview-stat-head {
  align-items: center;
  gap: 10rpx;
}

.growth-page__overview-stat-icon,
.growth-page__exploration-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 16rpx;
}

.growth-page__overview-stat-icon {
  width: 34rpx;
  height: 34rpx;
}

.growth-page__overview-stat-icon--coral,
.growth-page__exploration-icon--coral { background: #ffe8e5; }
.growth-page__overview-stat-icon--gold,
.growth-page__exploration-icon--gold { background: #fff1cf; }
.growth-page__exploration-icon--teal { background: #e0f1f8; }

.growth-page__overview-stat-label {
  color: #718096;
  font-size: 22rpx;
  font-weight: 700;
}

.growth-page__overview-stat-value {
  color: #203042;
  font-size: 34rpx;
  font-weight: 900;
}

.growth-page__overview-stat-description {
  color: #8a97a8;
  font-size: 21rpx;
  line-height: 1.4;
}

.growth-page__section {
  flex-direction: column;
  gap: var(--growth-space-2);
}

.growth-page__section-shell {
  padding: 24rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.growth-page__section-shell--adherence {
  background: #fffaf4;
}

.growth-page__section-shell--explore {
  background: rgba(255, 255, 255, 0.94);
}

.growth-page__section-shell--explore .growth-page__section-head {
  margin-bottom: 12rpx;
}

.growth-page__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--growth-space-2);
}

.growth-page__section-title {
  display: block;
  margin: 0;
  color: #1a202c;
  font-size: 30rpx;
  font-weight: 900;
}

.growth-page__section-description {
  display: block;
  max-width: 500rpx;
  color: #718096;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.48;
}

.growth-page__link {
  display: inline-flex;
  min-height: 48rpx;
  align-items: center;
  justify-content: center;
  padding: 10rpx 16rpx;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: #ff6f62;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: normal;
  text-decoration: none;
  transition: color 160ms ease-out, background-color 160ms ease-out, transform 160ms ease-out;
}

.growth-page__link::after { display: none; }

.growth-page__link:active {
  color: #203042;
  background: rgba(255, 211, 132, 0.16);
  transform: scale(0.98);
}

.growth-page__exploration-list {
  flex-direction: column;
  gap: 10rpx;
}

.growth-page__exploration-row {
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #fcf7f0;
  transition: opacity 160ms ease-out, transform 160ms ease-out;
}

.growth-page__exploration-row:first-child {
  padding-top: 22rpx;
}

.growth-page__exploration-row:active {
  opacity: 0.76;
  transform: scale(0.985);
}

.growth-page__exploration-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  transition: transform 160ms ease-out;
}

.growth-page__exploration-row:active .growth-page__exploration-icon {
  transform: rotate(-6deg) scale(0.94);
}

.growth-page__exploration-copy {
  min-width: 0;
  flex: 1;
  gap: 6rpx;
}

.growth-page__exploration-title {
  color: #203042;
  font-size: 28rpx;
  font-weight: 800;
}

.growth-page__exploration-meta {
  color: #c76b5b;
  font-size: 22rpx;
  font-weight: 700;
}

.growth-page__exploration-arrow {
  flex: none;
  color: #8a97a8;
  font-size: 32rpx;
  line-height: 1;
}
</style>
