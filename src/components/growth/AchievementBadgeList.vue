<script setup lang="ts">
import type { GrowthAchievement } from '../../features/growth/summary'

defineProps<{
  achievements: GrowthAchievement[]
}>()
</script>

<template>
  <section class="badge-grid" aria-label="Achievement badges">
    <article
      v-for="badge in achievements"
      :key="badge.id"
      :class="badge.earned ? 'badge badge--earned' : 'badge badge--locked'"
    >
      <p class="badge__title">{{ badge.title }}</p>
      <p class="badge__description">{{ badge.description }}</p>
      <span class="badge__status">{{ badge.earned ? 'Earned' : 'Locked' }}</span>
    </article>
  </section>
</template>

<style scoped>
.badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.badge {
  border-radius: 10px;
  padding: 0.75rem;
  border: 1px solid #d7ddef;
}

.badge--earned {
  background: linear-gradient(140deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #60a5fa;
}

.badge--locked {
  background: #f8fafc;
}

.badge__title {
  margin: 0;
  font-weight: 600;
  color: #21345f;
}

.badge__description {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: #586780;
}

.badge__status {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.76rem;
  color: #2f4ea6;
}
</style>
