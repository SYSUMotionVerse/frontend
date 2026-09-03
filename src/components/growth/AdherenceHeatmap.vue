<script setup lang="ts">
import { computed } from 'vue'
import type { GrowthCalendarDay } from '../../features/growth/summary'

const props = withDefaults(defineProps<{
  days: GrowthCalendarDay[]
  selectable?: boolean
  selectedDate?: string
  showDateLabels?: boolean
}>(), {
  selectable: false,
  selectedDate: '',
  showDateLabels: false
})

const emit = defineEmits<{
  select: [date: string]
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
    while (activeWeek.length < 7) {
      activeWeek.push(null)
    }
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

  const selectedClass = props.selectedDate === day.date ? ' adherence-cell--selected' : ''
  const datedClass = props.showDateLabels ? ' adherence-cell--dated' : ''
  return `adherence-cell ${statusClass} adherence-cell--level-${level}${selectedClass}${datedClass}`
}

function dateNumber(date: string) {
  return Number(date.slice(-2))
}

function selectDay(day: GrowthCalendarDay) {
  if (props.selectable) emit('select', day.date)
}
</script>

<template>
  <view :class="['adherence-shell', { 'adherence-shell--dated': showDateLabels }]">
    <view class="adherence-chart">
      <view class="adherence-weekdays" aria-hidden="true">
        <text v-for="label in weekdayLabels" :key="label">{{ label }}</text>
      </view>
      <view class="adherence" aria-label="坚持热力图">
        <view
          v-for="(week, weekIndex) in groupedWeeks"
          :key="weekIndex"
          class="adherence-week"
        >
          <button
            v-for="(day, dayIndex) in week"
            :key="day?.date ?? `empty-${weekIndex}-${dayIndex}`"
            :class="day
              ? cellClass(day)
              : ['adherence-cell', 'adherence-cell--empty', { 'adherence-cell--dated': showDateLabels }]"
            :aria-label="day ? `${day.date}：已完成 ${day.completedSessions} 次训练` : undefined"
            :title="day ? `${day.date}：已完成 ${day.completedSessions} 次训练` : undefined"
            :disabled="!day || !selectable"
            type="button"
            @click="day && selectDay(day)"
          >
            <text v-if="day && showDateLabels" class="adherence-cell__date">{{ dateNumber(day.date) }}</text>
          </button>
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
  align-items: flex-end;
  gap: 88rpx;
}

.adherence-chart {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
}

.adherence-weekdays {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.adherence-weekdays text {
  width: 32rpx;
  height: 32rpx;
  color: #718096;
  font-size: 24rpx;
  line-height: 32rpx;
  text-align: center;
}

.adherence {
  display: flex;
  width: 100%;
  max-height: 246rpx;
  flex-direction: column;
  gap: 12rpx;
  overflow-y: auto;
  padding-right: 2rpx;
}

.adherence-week {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.adherence-cell {
  display: inline-flex;
  width: 32rpx;
  height: 32rpx;
  align-items: center;
  justify-content: center;
  flex: none;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  line-height: 1;
}

.adherence-cell::after { display: none; }
.adherence-cell[disabled] { opacity: 1; }

.adherence-cell--empty {
  visibility: hidden;
}

.adherence-cell--level-0,
.adherence-legend__swatch--level-0 {
  background: #eef7ff;
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

.adherence-shell--dated {
  align-items: flex-end;
  gap: 28rpx;
  overflow: visible;
}

.adherence-shell--dated .adherence-chart,
.adherence-shell--dated .adherence-week,
.adherence-shell--dated .adherence {
  overflow: visible;
}

.adherence-shell--dated .adherence {
  max-height: none;
  padding: 6rpx 8rpx;
  box-sizing: border-box;
}

.adherence-shell--dated .adherence-weekdays {
  padding: 0 8rpx;
  box-sizing: border-box;
}

.adherence-shell--dated .adherence-weekdays text {
  width: 48rpx;
  height: 32rpx;
}

.adherence-cell--dated {
  width: 48rpx;
  height: 48rpx;
  color: #64748b;
}

.adherence-cell--dated.adherence-cell--level-2,
.adherence-cell--dated.adherence-cell--level-3 {
  color: #7f4242;
}

.adherence-cell--selected {
  box-shadow: 0 0 0 4rpx #203042;
}

.adherence-cell__date {
  font-size: 18rpx;
  font-weight: 900;
  line-height: 1;
}

.adherence-legend {
  display: flex;
  width: 32rpx;
  flex: none;
  align-items: center;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8rpx;
}

.adherence-legend__label {
  color: #8899b4;
  font-size: 22rpx;
  line-height: 28rpx;
}

.adherence-legend__swatch {
  width: 24rpx;
  height: 24rpx;
  border-radius: 9999px;
}
</style>
