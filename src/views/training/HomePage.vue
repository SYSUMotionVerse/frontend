<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import DailyProgressCard from '../../components/training/DailyProgressCard.vue'
import ReminderBanner from '../../components/training/ReminderBanner.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'

const route = useRoute()
const { state, refreshReminderEligibility, setReminderSource } = useStudentAppState()

const showReminderBanner = computed(() => state.reminderSource === 'wechat-reminder' && state.dailyAdherence.validCheckIns < 3)

watchEffect(() => {
  if (route.query.source === 'reminder') {
    setReminderSource('wechat-reminder')
  }

  refreshReminderEligibility()
})
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-420 flex-col gap-18 px-20 py-24">
    <ReminderBanner :visible="showReminderBanner" />

    <DailyProgressCard
      :qualifying-days="state.weeklyAdherence.qualifyingDays"
      :reminder-eligible="state.dailyAdherence.reminderEligible"
      :valid-check-ins="state.dailyAdherence.validCheckIns"
    />

    <section class="card-shell p-20">
      <p class="section-title">Choose your next exercise snack</p>
      <p class="mt-10 text-[28px] leading-[40px] text-slate-600">
        Mix Wushu, HIIT, and stair-climbing freely. Each finished guided flow counts.
      </p>

      <div class="mt-18 flex gap-12">
        <RouterLink
          class="home-action home-action--primary flex-1"
          to="/training/select"
        >
          Start training
        </RouterLink>
        <RouterLink
          class="home-action home-action--secondary"
          to="/growth"
        >
          Open growth
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-action {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 4rem;
  border-radius: 9999px;
  padding: 1rem 1.25rem;
  font-size: 28px;
  line-height: 1.3;
  text-align: center;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 6px 0 rgba(26, 32, 44, 0.08);
  transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}

.home-action:hover {
  transform: translateY(-1px);
}

.home-action:focus-visible {
  outline: 3px solid rgba(34, 48, 74, 0.25);
  outline-offset: 2px;
}

.home-action--primary {
  background: #ff7f6a;
  color: white;
}

.home-action--secondary {
  background: rgb(241 245 249);
  color: rgb(71 85 105);
}
</style>
