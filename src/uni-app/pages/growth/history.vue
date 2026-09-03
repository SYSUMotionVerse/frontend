<script setup lang="ts">
import { ref } from 'vue'
import AssessmentHistoryList from '../../../components/growth/AssessmentHistoryList.vue'
import GrowthHistoryTrendPanel from '../../../components/growth/GrowthHistoryTrendPanel.vue'
import GrowthLoadStatus from '../../../components/growth/GrowthLoadStatus.vue'
import TrainingWeekHistory from '../../../components/growth/TrainingWeekHistory.vue'
import UniGrowthPageShell from '../../components/growth/UniGrowthPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import { useGrowthOverview } from '../../composables/useGrowthOverview'

const { assessments, loadState, refresh, sessions } = useGrowthOverview({
  sections: ['history']
})
const isRefreshing = ref(false)

async function handlePullDownRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await refresh({ force: true })
  } finally {
    isRefreshing.value = false
  }
}
</script>

<template>
  <UniGrowthPageShell
    :show-dock="false"
    page-title="历史记录"
    show-back
    refresh-enabled
    :refreshing="isRefreshing"
    @refresh="handlePullDownRefresh"
  >
    <UniPageHeading
      inset
      eyebrow="成长"
      title="训练与评估历史"
      description="集中查看训练记录与长问卷评估。"
    />

    <GrowthLoadStatus
      :status="loadState.status"
      :message="loadState.message"
      @retry="refresh({ force: true })"
    />

    <section class="detail-page__card">
      <h2 class="detail-page__heading">变化趋势</h2>
      <GrowthHistoryTrendPanel :sessions="sessions" :assessments="assessments" />
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">训练记录</h2>
      <TrainingWeekHistory :sessions="sessions" />
    </section>

    <section class="detail-page__card">
      <h2 class="detail-page__heading">长问卷</h2>
      <AssessmentHistoryList :assessments="assessments" />
    </section>
  </UniGrowthPageShell>
</template>

<style scoped>
.detail-page__card { margin-bottom: 28rpx; border: 2rpx solid rgba(255, 211, 132, 0.3); border-radius: 28rpx; padding: 32rpx; background: rgba(255, 255, 255, 0.94); }
.detail-page__heading { margin: 0 0 20rpx; color: #203042; font-size: 32rpx; }
</style>
