<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, ref } from 'vue'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import GrowthLoadStatus from '../../../components/growth/GrowthLoadStatus.vue'
import TrainingHistoryList from '../../../components/growth/TrainingHistoryList.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'

const { adherenceData, loadState, refresh, sessions } = useGrowthOverview({
  sections: ['adherence', 'history']
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
const isRefreshing = ref(false)

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const monthCursor = ref(currentMonth)
const selectedDate = ref(toIsoDate(today))

const monthTitle = computed(() => {
  const [year, month] = monthCursor.value.split('-').map(Number)
  return `${year} 年 ${month} 月`
})

const monthCalendar = computed(() => {
  const [year, month] = monthCursor.value.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const counts = sessions.value.reduce<Record<string, number>>((result, session) => {
    result[session.date] = (result[session.date] ?? 0) + 1
    return result
  }, {})

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
    const completedSessions = counts[date] ?? 0
    return {
      date,
      completedSessions,
      status: completedSessions >= 3 ? 'met-goal' as const : completedSessions > 0 ? 'partial' as const : 'none' as const
    }
  })
})

const earliestMonth = computed(() => sessions.value.map(session => session.date.slice(0, 7)).sort()[0] ?? currentMonth)
const canGoPreviousMonth = computed(() => monthCursor.value > earliestMonth.value)
const canGoNextMonth = computed(() => monthCursor.value < currentMonth)
const selectedSessions = computed(() => sessions.value.filter(session => session.date === selectedDate.value))
const selectedDateTitle = computed(() => {
  const [, month, day] = selectedDate.value.split('-').map(Number)
  return `${month} 月 ${day} 日`
})

function moveMonth(offset: number) {
  if (offset < 0 && !canGoPreviousMonth.value) return
  if (offset > 0 && !canGoNextMonth.value) return
  const [year, month] = monthCursor.value.split('-').map(Number)
  const next = new Date(year, month - 1 + offset, 1)
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  if (nextMonth < earliestMonth.value) return
  if (nextMonth > currentMonth) return
  monthCursor.value = nextMonth
  selectedDate.value = `${nextMonth}-01`
}

async function handlePullDownRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await refresh({ force: true })
  } finally {
    isRefreshing.value = false
  }
}

</script>

<template>
  <UniGrowthPageShell
    :show-dock="false"
    page-title="坚持情况"
    show-back
    refresh-enabled
    :refreshing="isRefreshing"
    @refresh="handlePullDownRefresh"
  >
    <UniPageHeading
      inset
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
      <view class="month-browser__navigator">
        <button
          class="month-browser__arrow"
          :class="{ 'month-browser__arrow--disabled': !canGoPreviousMonth }"
          type="button"
          aria-label="上个月"
          :disabled="!canGoPreviousMonth"
          @click="moveMonth(-1)"
        >
          <uni-icons type="left" size="20" :color="canGoPreviousMonth ? '#203042' : '#c5ccd5'" />
        </button>
        <view class="month-browser__title-group">
          <text class="month-browser__eyebrow">月度打卡</text>
          <text class="month-browser__title">{{ monthTitle }}</text>
        </view>
        <button
          class="month-browser__arrow"
          :class="{ 'month-browser__arrow--disabled': !canGoNextMonth }"
          type="button"
          aria-label="下个月"
          :disabled="!canGoNextMonth"
          @click="moveMonth(1)"
        >
          <uni-icons type="right" size="20" :color="canGoNextMonth ? '#203042' : '#c5ccd5'" />
        </button>
      </view>
      <AdherenceHeatmap
        :days="monthCalendar"
        selectable
        show-date-labels
        :selected-date="selectedDate"
        @select="selectedDate = $event"
      />
      <p class="detail-page__note">点击日期查看当天记录，颜色越深代表训练次数越多，3 次即达标。</p>
    </section>

    <section class="detail-page__card">
      <view class="selected-records__head">
        <view>
          <text class="selected-records__eyebrow">当天记录</text>
          <h2 class="detail-page__section-title selected-records__title">{{ selectedDateTitle }}</h2>
        </view>
        <text class="selected-records__count">{{ selectedSessions.length }} 次</text>
      </view>
      <TrainingHistoryList :sessions="selectedSessions" />
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

.month-browser__navigator,
.month-browser__title-group,
.selected-records__head {
  display: flex;
}

.month-browser__navigator {
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 24rpx;
}

.month-browser__arrow {
  display: inline-flex;
  width: 66rpx;
  height: 66rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 20rpx;
  background: #fcf7f0;
}

.month-browser__arrow::after { display: none; }
.month-browser__arrow--disabled { opacity: 0.62; }

.month-browser__title-group {
  flex: 1;
  align-items: center;
  flex-direction: column;
  gap: 4rpx;
}

.month-browser__eyebrow,
.selected-records__eyebrow {
  color: #8a97a8;
  font-size: 20rpx;
  font-weight: 700;
}

.month-browser__title {
  color: #203042;
  font-size: 28rpx;
  font-weight: 900;
}

.selected-records__head {
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.selected-records__eyebrow,
.selected-records__title {
  display: block;
}

.selected-records__title {
  margin: 5rpx 0 0;
}

.selected-records__count {
  color: #c76b5b;
  font-size: 22rpx;
  font-weight: 900;
}
</style>
