<script setup lang="ts">
import { computed } from 'vue'
import type { GrowthCalendarDay } from '../../features/growth/summary'

const props = defineProps<{
  days: GrowthCalendarDay[]
}>()

const legendLevels = [0, 1, 2, 3] as const
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const groupedWeeks = computed(() => {
  const weeks: Array<Array<GrowthCalendarDay | null>> = []
  let activeWeek: Array<GrowthCalendarDay | null> = []
  const firstDate = props.days[0]?.date
  if (firstDate) {
    const weekday = new Date(`${firstDate}T00:00:00`).getDay()
    const mondayFirstOffset = (weekday + 6) % 7
    activeWeek = Array.from({ length: mondayFirstOffset }, () => null)
  }

  props.days.forEach(day => {
    activeWeek.push(day)
    if (activeWeek.length === 7) {
      weeks.push(activeWeek)
      activeWeek = []
    }
  })

  if (activeWeek.length > 0) {
    weeks.push(activeWeek)
  }

  return weeks
})

function cellClass(day: GrowthCalendarDay): string {
  const level = day.completedSessions >= 3
    ? 3
    : day.completedSessions >= 2
      ? 2
      : day.completedSessions >= 1
        ? 1
        : 0
  const statusClass = level === 3
    ? 'adherence-cell--met'
    : level > 0
      ? 'adherence-cell--partial'
      : 'adherence-cell--none'

  return `adherence-cell ${statusClass} adherence-cell--level-${level}`
}
</script>

<template>
  <view class="adherence-shell">
    <view class="adherence-grid">
      <view class="adherence-weekdays" aria-hidden="true">
        <text v-for="label in weekdayLabels" :key="label">{{ label }}</text>
      </view>
      <view class="adherence" aria-label="坚持热力图">
        <view
          v-for="(week, weekIndex) in groupedWeeks"
          :key="weekIndex"
          class="adherence-week"
        >
          <view
            v-for="(day, dayIndex) in week"
            :key="day?.date ?? `empty-${weekIndex}-${dayIndex}`"
            :class="day ? cellClass(day) : 'adherence-cell adherence-cell--empty'"
            :aria-label="day ? `${day.date}：已完成 ${day.completedSessions} 次训练` : undefined"
            :title="day ? `${day.date}：已完成 ${day.completedSessions} 次训练` : undefined"
          />
        </view>
      </view>
    </view>

    <view class="adherence-legend" aria-label="训练次数颜色图例">
      <text class="adherence-legend__label">少</text>
      <view
        v-for="level in legendLevels"
        :key="level"
        :class="`adherence-legend__swatch adherence-legend__swatch--level-${level}`"
      />
      <text class="adherence-legend__label">多</text>
    </view>
  </view>
</template>

<style scoped>
.adherence-shell {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.adherence-grid {
  display: flex;
  gap: 12rpx;
}

.adherence-weekdays {
  display: flex;
  flex: 0 0 32rpx;
  flex-direction: column;
  gap: 12rpx;
}

.adherence-weekdays text {
  width: 32rpx;
  height: 32rpx;
  color: #718096;
  font-size: 22rpx;
  line-height: 32rpx;
  text-align: center;
}

.adherence {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding-bottom: 8rpx;
}

.adherence-week {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.adherence-cell {
  width: 32rpx;
  height: 32rpx;
  border-radius: 9999px;
}

.adherence-cell--empty {
  visibility: hidden;
}

.adherence-cell--level-0,
.adherence-legend__swatch--level-0 {
  background: #f1f5f9;
}

.adherence-cell--level-1,
.adherence-legend__swatch--level-1 {
  background: #ffe1e1;
}

.adherence-cell--level-2,
.adherence-legend__swatch--level-2 {
  background: #ffb8b8;
}

.adherence-cell--level-3,
.adherence-legend__swatch--level-3 {
  background: #FF8B8B;
}

.adherence-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
}

.adherence-legend__label {
  color: #8899b4;
  font-size: 22rpx;
}

.adherence-legend__swatch {
  width: 24rpx;
  height: 24rpx;
  border-radius: 9999px;
}
</style>
