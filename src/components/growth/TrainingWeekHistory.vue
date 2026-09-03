<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, ref } from 'vue'
import type { GrowthTrainingHistoryItem } from '../../uni-app/api/studentBackendTypes'
import TrainingHistoryList from './TrainingHistoryList.vue'

const props = defineProps<{
  sessions: GrowthTrainingHistoryItem[]
}>()

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function addDays(date: Date, count: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + count)
  return result
}

const today = toIsoDate(new Date())
const currentWeekStart = toIsoDate(startOfWeek(parseIsoDate(today)))
const weekStart = ref(currentWeekStart)
const selectedDate = ref(today)

const sessionCountByDate = computed(() => props.sessions.reduce<Record<string, number>>((counts, session) => {
  counts[session.date] = (counts[session.date] ?? 0) + 1
  return counts
}, {}))

const weekDays = computed(() => {
  const start = parseIsoDate(weekStart.value)
  return weekdayLabels.map((weekday, index) => {
    const date = addDays(start, index)
    const isoDate = toIsoDate(date)
    return {
      date: isoDate,
      weekday,
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      count: sessionCountByDate.value[isoDate] ?? 0
    }
  })
})

const weekRangeLabel = computed(() => {
  const first = weekDays.value[0]
  const last = weekDays.value[6]
  if (!first || !last) return ''
  return `${first.dateLabel} – ${last.dateLabel}`
})

const earliestWeekStart = computed(() => {
  const earliestDate = props.sessions.map(session => session.date).sort()[0]
  return earliestDate ? toIsoDate(startOfWeek(parseIsoDate(earliestDate))) : currentWeekStart
})
const canGoPrevious = computed(() => weekStart.value > earliestWeekStart.value)
const canGoNext = computed(() => weekStart.value < currentWeekStart)
const selectedSessions = computed(() => props.sessions.filter(session => session.date === selectedDate.value))
const selectedDateLabel = computed(() => {
  const date = parseIsoDate(selectedDate.value)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
})

function moveWeek(offset: number) {
  if (offset < 0 && !canGoPrevious.value) return
  if (offset > 0 && !canGoNext.value) return
  const nextStart = addDays(parseIsoDate(weekStart.value), offset * 7)
  const nextIso = toIsoDate(nextStart)
  if (nextIso < earliestWeekStart.value) return
  if (nextIso > currentWeekStart) return
  weekStart.value = nextIso
  selectedDate.value = nextIso === currentWeekStart ? today : nextIso
}

function heatLevel(count: number) {
  if (count >= 3) return 3
  if (count >= 2) return 2
  if (count >= 1) return 1
  return 0
}
</script>

<template>
  <view class="week-history">
    <view class="week-history__navigator" aria-label="选择训练记录周">
      <button
        class="week-history__arrow"
        :class="{ 'week-history__arrow--disabled': !canGoPrevious }"
        type="button"
        aria-label="上一周"
        :disabled="!canGoPrevious"
        @click="moveWeek(-1)"
      >
        <uni-icons type="left" size="20" :color="canGoPrevious ? '#203042' : '#c5ccd5'" />
      </button>
      <view class="week-history__range">
        <text class="week-history__range-label">训练周</text>
        <text class="week-history__range-value">{{ weekRangeLabel }}</text>
      </view>
      <button
        class="week-history__arrow"
        :class="{ 'week-history__arrow--disabled': !canGoNext }"
        type="button"
        aria-label="下一周"
        :disabled="!canGoNext"
        @click="moveWeek(1)"
      >
        <uni-icons type="right" size="20" :color="canGoNext ? '#203042' : '#c5ccd5'" />
      </button>
    </view>

    <view class="week-history__days" aria-label="选择日期">
      <button
        v-for="day in weekDays"
        :key="day.date"
        :class="[
          'week-history__day',
          `week-history__day--level-${heatLevel(day.count)}`,
          { 'week-history__day--selected': selectedDate === day.date }
        ]"
        type="button"
        :aria-label="`${day.date}，${day.count} 次训练`"
        @click="selectedDate = day.date"
      >
        <text class="week-history__weekday">{{ day.weekday }}</text>
        <text class="week-history__date">{{ day.dateLabel }}</text>
        <view class="week-history__heat-dot" />
      </button>
    </view>

    <view class="week-history__selected-head">
      <view>
        <text class="week-history__selected-label">当天记录</text>
        <text class="week-history__selected-date">{{ selectedDateLabel }}</text>
      </view>
      <text class="week-history__selected-count">{{ selectedSessions.length }} 次</text>
    </view>

    <TrainingHistoryList :sessions="selectedSessions" />
  </view>
</template>

<style scoped>
.week-history {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.week-history__navigator,
.week-history__range,
.week-history__days,
.week-history__day,
.week-history__selected-head {
  display: flex;
}

.week-history__navigator {
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.week-history__arrow {
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

.week-history__arrow::after { display: none; }
.week-history__arrow--disabled { opacity: 0.62; }

.week-history__range {
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4rpx;
}

.week-history__range-label,
.week-history__selected-label {
  color: #8a97a8;
  font-size: 20rpx;
  font-weight: 700;
}

.week-history__range-value {
  color: #203042;
  font-size: 28rpx;
  font-weight: 900;
}

.week-history__days {
  align-items: stretch;
  justify-content: space-between;
  gap: 8rpx;
}

.week-history__day {
  min-width: 0;
  min-height: 112rpx;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7rpx;
  padding: 10rpx 3rpx;
  border: 0;
  border-radius: 18rpx;
  background: #f5f9fc;
  color: #718096;
}

.week-history__day::after { display: none; }

.week-history__day--selected {
  box-shadow: inset 0 0 0 3rpx #203042;
  color: #203042;
}

.week-history__weekday {
  font-size: 21rpx;
  font-weight: 900;
}

.week-history__date {
  font-size: 18rpx;
  font-weight: 700;
  white-space: nowrap;
}

.week-history__heat-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 9999px;
  background: #eef7ff;
}

.week-history__day--level-1 .week-history__heat-dot { background: #ffe1e1; }
.week-history__day--level-2 .week-history__heat-dot { background: #ffb8b8; }
.week-history__day--level-3 .week-history__heat-dot { background: #ff8b8b; }

.week-history__selected-head {
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  padding-top: 4rpx;
}

.week-history__selected-label,
.week-history__selected-date {
  display: block;
}

.week-history__selected-date {
  margin-top: 5rpx;
  color: #203042;
  font-size: 28rpx;
  font-weight: 900;
}

.week-history__selected-count {
  color: #c76b5b;
  font-size: 22rpx;
  font-weight: 900;
}
</style>
