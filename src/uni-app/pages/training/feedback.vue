<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import SessionFeedbackCard from '../../../components/training/SessionFeedbackCard.vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const sessionId = ref('latest')

onLoad((query) => {
  const nextQuery = query ?? {}
  sessionId.value = nextQuery.sessionId?.toString() ?? 'latest'
})

onShow(() => {
  store.refreshReminderEligibility()
})

const session = computed(() => {
  const snapshot = store.getSnapshot()
  if (sessionId.value === 'latest') {
    return snapshot.sessions.at(-1) ?? null
  }

  return snapshot.sessions.find(item => item.id === sessionId.value) ?? null
})

const modalityLabel = computed(() => {
  if (!session.value) {
    return '训练'
  }

  return session.value.modality === 'stair'
    ? '楼梯训练'
    : session.value.modality === 'hiit'
      ? 'HIIT'
      : '武术'
})

function goHome() {
  void uni.redirectTo({
    url: '/pages/training/home'
  })
}

function goGrowthCenter() {
  void uni.redirectTo({
    url: '/pages/growth/index'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="T3"
    title="训练反馈"
    subtitle="本次训练质量评估已生成，请查看结果并继续成长任务。"
  >
    <SessionFeedbackCard
      :modality-label="modalityLabel"
      :quality-score="session?.analysis.qualityScore ?? 0"
      :summary="session?.analysis.summary ?? '完成引导训练，干得漂亮！'"
    />

    <view class="feedback-page__actions">
      <button
        class="btn-primary feedback-page__primary-action"
        type="button"
        @click="goHome"
      >
        <text>返回首页</text>
      </button>
      <button
        class="btn-secondary feedback-page__secondary-action"
        type="button"
        @click="goGrowthCenter"
      >
        <text>成长中心</text>
      </button>
    </view>
  </UniAccessPageShell>
</template>

<style scoped>
.feedback-page__actions {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 40rpx;
}

.feedback-page__primary-action,
.feedback-page__secondary-action {
  width: 100%;
}
</style>
