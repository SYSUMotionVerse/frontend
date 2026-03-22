<script setup lang="ts">
import type { SessionRecord } from '../../types/student'

defineProps<{
  sessions: SessionRecord[]
}>()
</script>

<template>
  <section class="history" aria-label="Training history">
    <p v-if="sessions.length === 0" class="history__empty">No completed sessions yet.</p>

    <ul v-else class="history__list">
      <li v-for="session in sessions" :key="session.id" class="history-item">
        <p class="history-item__headline">
          {{ session.modality.toUpperCase() }} · {{ session.date }}
        </p>
        <p class="history-item__subline">{{ session.analysis.summary }}</p>
        <p class="history-item__meta">Quality score: {{ session.analysis.qualityScore }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.history__empty {
  margin: 0;
  padding: 0.8rem;
  border-radius: 10px;
  border: 1px dashed #bfd2ef;
  color: #566782;
}

.history__list {
  display: grid;
  gap: 0.6rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-item {
  border-radius: 10px;
  border: 1px solid #d8e5fa;
  background: #fff;
  padding: 0.7rem;
}

.history-item__headline {
  margin: 0;
  color: #1d366c;
  font-weight: 600;
}

.history-item__subline {
  margin: 0.25rem 0 0;
  color: #4b5f82;
  font-size: 0.82rem;
}

.history-item__meta {
  margin: 0.25rem 0 0;
  color: #5c6f90;
  font-size: 0.78rem;
}
</style>
