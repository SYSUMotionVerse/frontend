<script setup lang="ts">
import { computed } from 'vue'
import AchievementBadgeList from '../../../components/growth/AchievementBadgeList.vue'
import { buildGrowthSummary } from '../../../domain/student/growth'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const summary = computed(() => buildGrowthSummary(store.getSnapshot()))
</script>

<template>
  <UniGrowthPageShell>
    <h1 class="detail-page__title">Achievements Detail</h1>
    <p class="detail-page__subtitle">Motivational milestones based on participation and consistency.</p>

    <section class="detail-page__card">
      <AchievementBadgeList :achievements="summary.achievements" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__title { margin: 0; color: #1d366b; }
.detail-page__subtitle { margin: 0; color: #576988; font-size: 0.88rem; }
.detail-page__card { border: 1px solid #dbe5f7; border-radius: 12px; padding: 0.9rem; background: #fff; }
</style>
