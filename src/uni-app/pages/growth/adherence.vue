<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import { buildGrowthSummary } from '../../../domain/student/growth'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'

const store = useStudentStore()
const summary = computed(() => buildGrowthSummary(store.getSnapshot()))

// --- Backend compliance data ---
const complianceTodayCount = ref(0)
const complianceTodayCompleted = ref(false)
const complianceRate = ref(0)
const complianceCompletedDays = ref(0)
const complianceTrend = ref<Array<{
  label: string
  completedDays: number
  completionRate: number
}>>([])
const complianceLoaded = ref(false)

onMounted(async () => {
  try {
    const data = await studentBackendSync.loadAdherenceData()
    if (data) {
      complianceTodayCount.value = data.todayCount
      complianceTodayCompleted.value = data.todayCompleted
      complianceRate.value = data.complianceRate
      complianceCompletedDays.value = data.completedDays
      complianceTrend.value = data.trend.slice(-8) // show latest 8 weeks
      complianceLoaded.value = true
    }
  } catch (error) {
    reportBackendSyncError('打卡数据加载', error)
  }
})

// --- Calendar from local sessions ---
const calendarDays = computed(() => summary.value.adherenceCalendar)

// --- Weekday labels ---
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <UniGrowthPageShell dock-tab="growth">
    <h1 class="detail-page__title">达标详情</h1>
    <p class="detail-page__subtitle">训练坚持记录与依从性分析。</p>

    <!-- Backend stats row -->
    <section v-if="complianceLoaded" class="detail-page__stats">
      <view class="stat-item">
        <span class="stat-value">{{ complianceTodayCount }}/3</span>
        <span class="stat-label">今日打卡</span>
      </view>
      <view class="stat-item">
        <span class="stat-value" :class="{ 'stat-value--done': complianceTodayCompleted }">
          {{ complianceTodayCompleted ? '✓' : '—' }}
        </span>
        <span class="stat-label">今日达标</span>
      </view>
      <view class="stat-item">
        <span class="stat-value">{{ complianceCompletedDays }}</span>
        <span class="stat-label">累计达标天</span>
      </view>
      <view class="stat-item">
        <span class="stat-value">{{ Math.round(complianceRate * 100) }}%</span>
        <span class="stat-label">依从率</span>
      </view>
    </section>

    <!-- Weekly trend bars -->
    <section v-if="complianceLoaded && complianceTrend.length > 0" class="detail-page__card">
      <h2 class="detail-page__section-title">周达标趋势</h2>
      <view class="trend-bars">
        <view v-for="(item, idx) in complianceTrend" :key="idx" class="trend-bar-item">
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

    <!-- Heatmap from local sessions -->
    <section class="detail-page__card">
      <h2 class="detail-page__section-title">近期热力图</h2>
      <view class="heatmap-header">
        <span v-for="label in weekdayLabels" :key="label" class="weekday-label">{{ label }}</span>
      </view>
      <AdherenceHeatmap :days="calendarDays" />
      <p class="detail-page__note">每个方块代表一天，颜色越深表示达标。</p>
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0.25rem 0 0.5rem; color: #576988; font-size: 0.88rem; }
.detail-page__section-title { margin: 0 0 0.6rem; color: #1d366b; font-size: 0.92rem; }

.detail-page__card {
  border: 1px solid #dbe5f7;
  border-radius: 12px;
  padding: 0.9rem;
  background: #fff;
  margin-bottom: 0.8rem;
}

.detail-page__stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.8rem;
}
.stat-item {
  flex: 1;
  background: #fff;
  border: 1px solid #dbe5f7;
  border-radius: 10px;
  padding: 0.6rem;
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 1.2rem;
  font-weight: 800;
  color: #1d366b;
}
.stat-value--done {
  color: #22c55e;
  font-size: 1.4rem;
}
.stat-label {
  display: block;
  font-size: 0.7rem;
  color: #8899b4;
  margin-top: 0.15rem;
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
  transition: height 0.3s ease;
}
.trend-bar-label {
  font-size: 0.65rem;
  color: #8899b4;
}

.heatmap-header {
  display: flex;
  gap: 32rpx;
  margin-bottom: 8rpx;
  padding: 0 4rpx;
}
.weekday-label {
  width: 32rpx;
  text-align: center;
  font-size: 0.65rem;
  color: #8899b4;
}

.detail-page__note { margin: 0.65rem 0 0; color: #5a6b89; font-size: 0.8rem; }
</style>
