<script setup lang="ts">
import { computed } from 'vue'
import type {
  GrowthAssessmentHistoryItem,
  GrowthTrainingHistoryItem
} from '../../uni-app/api/studentBackendTypes'

const props = defineProps<{
  sessions: GrowthTrainingHistoryItem[]
  assessments: GrowthAssessmentHistoryItem[]
}>()

interface TrendPoint {
  key: string
  label: string
  value: number
  valueLabel: string
  height: number
}

const trainingTrend = computed<TrendPoint[]>(() => {
  const counts = new Map<string, number>()
  props.sessions.forEach((session) => {
    counts.set(session.date, (counts.get(session.date) ?? 0) + 1)
  })
  const points = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
  const maximum = Math.max(1, ...points.map(([, count]) => count))

  return points.map(([date, count]) => ({
    key: date,
    label: date.slice(5).replace('-', '/'),
    value: count,
    valueLabel: `${count} 次`,
    height: Math.max(12, Math.round((count / maximum) * 100))
  }))
})

const assessmentTrend = computed<TrendPoint[]>(() =>
  props.assessments
    .filter(assessment => assessment.submittedAt)
    .sort((left, right) => (left.submittedAt ?? '').localeCompare(right.submittedAt ?? ''))
    .slice(-6)
    .map(assessment => ({
      key: `${assessment.checkpoint}-${assessment.submittedAt}`,
      label: assessment.title.replace('运动心理健康量表', '评估'),
      value: assessment.percentage,
      valueLabel: `${Math.round(assessment.percentage)}%`,
      height: Math.max(8, Math.min(100, Math.round(assessment.percentage)))
    }))
)
</script>

<template>
  <view class="history-trends">
    <view class="history-trends__section">
      <text class="history-trends__title">训练频次趋势</text>
      <view
        v-if="trainingTrend.length > 0"
        class="history-trends__chart"
        aria-label="最近七个训练日的训练次数趋势"
      >
        <view
          v-for="point in trainingTrend"
          :key="point.key"
          class="history-trends__point"
          :aria-label="`${point.label}，${point.valueLabel}`"
        >
          <text class="history-trends__value">{{ point.valueLabel }}</text>
          <view class="history-trends__track">
            <view
              class="history-trends__bar history-trends__bar--training"
              :style="{ height: `${point.height}%` }"
            />
          </view>
          <text class="history-trends__label">{{ point.label }}</text>
        </view>
      </view>
      <text v-else class="history-trends__empty">完成首次训练后，这里会显示训练频次变化。</text>
    </view>

    <view class="history-trends__section">
      <text class="history-trends__title">评估得分趋势</text>
      <view
        v-if="assessmentTrend.length > 0"
        class="history-trends__chart"
        aria-label="最近六次长问卷评估得分趋势"
      >
        <view
          v-for="point in assessmentTrend"
          :key="point.key"
          class="history-trends__point"
          :aria-label="`${point.label}，${point.valueLabel}`"
        >
          <text class="history-trends__value">{{ point.valueLabel }}</text>
          <view class="history-trends__track">
            <view
              class="history-trends__bar history-trends__bar--assessment"
              :style="{ height: `${point.height}%` }"
            />
          </view>
          <text class="history-trends__label">{{ point.label }}</text>
        </view>
      </view>
      <text v-else class="history-trends__empty">完成长问卷后，这里会显示阶段得分变化。</text>
    </view>
  </view>
</template>

<style scoped>
.history-trends {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.history-trends__section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.history-trends__title {
  color: #203042;
  font-size: 28rpx;
  font-weight: 800;
}

.history-trends__chart {
  display: flex;
  min-height: 220rpx;
  align-items: flex-end;
  gap: 12rpx;
}

.history-trends__point {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.history-trends__value {
  color: #526173;
  font-size: 20rpx;
  font-weight: 700;
}

.history-trends__track {
  display: flex;
  width: 100%;
  height: 130rpx;
  align-items: flex-end;
  overflow: hidden;
  border-radius: 10rpx;
  background: #f1f5f9;
}

.history-trends__bar {
  width: 100%;
  border-radius: 10rpx 10rpx 0 0;
}

.history-trends__bar--training {
  background: #2b7cb8;
}

.history-trends__bar--assessment {
  background: #c76b5b;
}

.history-trends__label {
  max-width: 100%;
  overflow: hidden;
  color: #718096;
  font-size: 18rpx;
  line-height: 1.3;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-trends__empty {
  color: #718096;
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
