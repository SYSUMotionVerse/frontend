<script setup lang="ts">
import { computed } from 'vue'
import type { GrowthCalendarDay } from '../../features/growth/summary'

const props = defineProps<{
  days: GrowthCalendarDay[]
}>()

const groupedWeeks = computed(() => {
  const weeks: GrowthCalendarDay[][] = []
  let activeWeek: GrowthCalendarDay[] = []

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
  if (day.status === 'met-goal') {
    return 'adherence-cell adherence-cell--met'
  }

  if (day.status === 'partial') {
    return 'adherence-cell adherence-cell--partial'
  }

  return 'adherence-cell adherence-cell--none'
}
</script>

<template>
  <section class="adherence" aria-label="Adherence heatmap">
    <div v-for="(week, weekIndex) in groupedWeeks" :key="weekIndex" class="adherence-week">
      <div
        v-for="day in week"
        :key="day.date"
        :class="cellClass(day)"
        :title="`${day.date}: ${day.completedSessions} completed session(s)`"
      />
    </div>
  </section>
</template>

<style scoped>
.adherence {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.adherence-week {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 0.3rem;
}

.adherence-cell {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 3px;
}

.adherence-cell--met {
  background: #3b82f6;
}

.adherence-cell--partial {
  background: #93c5fd;
}

.adherence-cell--none {
  background: #dbe5f8;
}
</style>
