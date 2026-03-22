<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import DailyProgressCard from '../../../components/training/DailyProgressCard.vue'
import ReminderBanner from '../../../components/training/ReminderBanner.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { resolveReminderSource } from '../../platform/reminders'

const store = useStudentStore()

const showReminderBanner = computed(() => {
  const snapshot = store.getSnapshot()
  return snapshot.reminderSource === 'wechat-reminder' && snapshot.dailyAdherence.validCheckIns < 3
})

onLoad((query) => {
  const nextQuery = query ?? {}
  const reminderSource = resolveReminderSource({
    source: nextQuery.source?.toString()
  })

  if (reminderSource) {
    store.setReminderSource(reminderSource)
  }
})

onShow(() => {
  store.refreshReminderEligibility()
})

function openTrainingSelection() {
  void uni.navigateTo({
    url: '/pages/training/select'
  })
}

function openGrowthCenter() {
  void uni.navigateTo({
    url: '/pages/growth/index'
  })
}
</script>

<template>
  <UniTrainingPageShell>
    <ReminderBanner :visible="showReminderBanner" />

    <DailyProgressCard
      :qualifying-days="store.state.weeklyAdherence.qualifyingDays"
      :reminder-eligible="store.state.dailyAdherence.reminderEligible"
      :valid-check-ins="store.state.dailyAdherence.validCheckIns"
    />

    <section class="card-shell p-20">
      <p class="section-title">Choose your next exercise snack</p>
      <p class="mt-10 text-[48rpx] leading-10 text-slate-600">
        Mix Wushu, HIIT, and stair-climbing freely. Each finished guided flow counts.
      </p>

      <div class="mt-18 flex gap-12">
        <view
          class="home-action home-action--primary flex-1"
          role="button"
          tabindex="0"
          @click="openTrainingSelection"
          @keydown.enter.prevent="openTrainingSelection"
          @keydown.space.prevent="openTrainingSelection"
        >
          Start training
        </view>
        <view
          class="home-action home-action--secondary"
          role="button"
          tabindex="0"
          @click="openGrowthCenter"
          @keydown.enter.prevent="openGrowthCenter"
          @keydown.space.prevent="openGrowthCenter"
        >
          Open growth
        </view>
      </div>
    </section>
  </UniTrainingPageShell>
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
  font-size: 44rpx;
  line-height: 1.3;
  text-align: center;
  font-weight: 700;
  box-shadow: 0 6px 0 rgba(26, 32, 44, 0.08);
  transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
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
