<script setup lang="ts">
import { computed } from 'vue'
import AchievementBadgeList from '../../components/growth/AchievementBadgeList.vue'
import AdherenceHeatmap from '../../components/growth/AdherenceHeatmap.vue'
import GrowthSummaryCards from '../../components/growth/GrowthSummaryCards.vue'
import PhysicalMetricsPanel from '../../components/growth/PhysicalMetricsPanel.vue'
import { buildGrowthSummary, resolvePhysicalMetricsState } from '../../features/growth/summary'
import { useStudentAppState } from '../../composables/useStudentAppState'

const { state } = useStudentAppState()

const summary = computed(() => buildGrowthSummary(state))
const physicalMetricsState = computed(() => resolvePhysicalMetricsState(state))
</script>

<template>
  <main class="growth-page">
    <header class="growth-page__header">
      <h1 class="growth-page__title">Growth Center</h1>
      <p class="growth-page__subtitle">
        Track your training consistency, assessments, and achievements.
      </p>
    </header>

    <GrowthSummaryCards :cards="summary.summaryCards" :latest-assessment="summary.latestAssessment" />

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">Adherence Calendar</h2>
        <RouterLink class="growth-page__link" to="/growth/adherence">View details</RouterLink>
      </div>
      <AdherenceHeatmap :days="summary.adherenceCalendar" />
    </section>

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">Achievements</h2>
        <RouterLink class="growth-page__link" to="/growth/achievements">View details</RouterLink>
      </div>
      <AchievementBadgeList :achievements="summary.achievements" />
    </section>

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">Physical Metrics</h2>
        <RouterLink class="growth-page__link" to="/growth/metrics">View details</RouterLink>
      </div>
      <PhysicalMetricsPanel :metrics-state="physicalMetricsState" />
    </section>
  </main>
</template>

<style scoped>
.growth-page {
  margin: 0 auto;
  width: min(880px, 100%);
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
}

.growth-page__header {
  display: grid;
  gap: 0.35rem;
}

.growth-page__title {
  margin: 0;
  color: #1f3568;
}

.growth-page__subtitle {
  margin: 0;
  color: #566884;
  font-size: 0.9rem;
}

.growth-page__section {
  border: 1px solid #d8e3f8;
  border-radius: 12px;
  padding: 0.85rem;
  background: #fbfdff;
}

.growth-page__section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  margin-bottom: 0.65rem;
}

.growth-page__section-title {
  margin: 0;
  font-size: 1rem;
  color: #243f72;
}

.growth-page__link {
  color: #355fb4;
  font-size: 0.8rem;
  text-decoration: none;
  border-radius: 9999px;
  padding: 0.2rem 0.45rem;
  transition: color 160ms ease, background-color 160ms ease, text-decoration-color 160ms ease;
}

.growth-page__link:hover {
  color: #1f3568;
  background: #eaf1ff;
  text-decoration: underline;
}

.growth-page__link:focus-visible {
  outline: 2px solid #355fb4;
  outline-offset: 2px;
  background: #eaf1ff;
  text-decoration: underline;
}
</style>
