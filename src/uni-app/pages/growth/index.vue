<script setup lang="ts">
import { computed } from 'vue'
import AchievementBadgeList from '../../../components/growth/AchievementBadgeList.vue'
import AdherenceHeatmap from '../../../components/growth/AdherenceHeatmap.vue'
import GrowthSummaryCards from '../../../components/growth/GrowthSummaryCards.vue'
import PhysicalMetricsPanel from '../../../components/growth/PhysicalMetricsPanel.vue'
import { buildGrowthSummary, resolvePhysicalMetricsState } from '../../../domain/student/growth'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()

const summary = computed(() => buildGrowthSummary(store.getSnapshot()))
const physicalMetricsState = computed(() => resolvePhysicalMetricsState(store.getSnapshot()))

function openDetailPage(page: 'adherence' | 'achievements' | 'metrics' | 'history') {
  void uni.navigateTo({
    url: `/pages/growth/${page}`
  })
}
</script>

<template>
  <UniGrowthPageShell>
    <header class="growth-page__header">
      <h1 class="growth-page__title">Growth Center</h1>
      <p class="growth-page__subtitle">
        Track your training consistency, assessments, and achievements.
      </p>
      <span class="growth-page__link growth-page__link--current">Current page</span>
    </header>

    <GrowthSummaryCards
      :cards="summary.summaryCards"
      :latest-assessment="summary.latestAssessment"
    />

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">Adherence Calendar</h2>
        <button class="growth-page__link" type="button" @click="openDetailPage('adherence')">
          View details
        </button>
      </div>
      <AdherenceHeatmap :days="summary.adherenceCalendar" />
    </section>

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">Achievements</h2>
        <button class="growth-page__link" type="button" @click="openDetailPage('achievements')">
          View details
        </button>
      </div>
      <AchievementBadgeList :achievements="summary.achievements" />
    </section>

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">Physical Metrics</h2>
        <button class="growth-page__link" type="button" @click="openDetailPage('metrics')">
          View details
        </button>
      </div>
      <PhysicalMetricsPanel :metrics-state="physicalMetricsState" />
    </section>

    <section class="growth-page__section">
      <div class="growth-page__section-head">
        <h2 class="growth-page__section-title">History</h2>
        <button class="growth-page__link" type="button" @click="openDetailPage('history')">
          View details
        </button>
      </div>
      <p class="growth-page__subtitle">Open session and questionnaire history.</p>
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
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
  border: none;
  background: transparent;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.growth-page__link--current {
  background: #eaf1ff;
  color: #1f3568;
  width: fit-content;
}

.growth-page__link:active {
  color: #1f3568;
  background: #eaf1ff;
  transform: scale(0.98);
}
</style>
