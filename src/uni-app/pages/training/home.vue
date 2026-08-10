<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import TrainingHomeCoachCard from '../../../components/training/TrainingHomeCoachCard.vue'
import TrainingHomeHeader from '../../../components/training/TrainingHomeHeader.vue'
import TrainingHomeProgressOverview from '../../../components/training/TrainingHomeProgressOverview.vue'
import QuestionnaireUnlockBanner from '../../../components/access/QuestionnaireUnlockBanner.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { useReminderConsent } from '../../composables/useReminderConsent'
import { useStationNotifications } from '../../composables/useStationNotifications'
import { useReminderReturn } from '../../composables/useReminderReturn'
import { useTrainingProgress } from '../../composables/useTrainingProgress'
import { useTrainingHomeProgressViewModel } from '../../composables/useTrainingHomeProgressViewModel'
import {
  continueRequiredQuestionnaire,
  useProtectedAccessState
} from '../../composables/useNavigationGuard'

const store = useStudentStore()
const reminderConsent = useReminderConsent()
const stationNotifications = useStationNotifications()
const reminderReturn = useReminderReturn()
const trainingProgress = useTrainingProgress()
const accessState = useProtectedAccessState()
const isBrowseOnly = computed(() => accessState.value.level === 'browse')

const displayName = computed(() => store.state.profile.name.trim() || '同学')
const {
  progress,
  reminderLabel,
  completedQuestCount,
  weeklyQualifyingDayCount
} = useTrainingHomeProgressViewModel({
  progressState: trainingProgress.state,
  displayName
})
const coachCards = computed(() => [
  {
    id: 'quote',
    eyebrow: '教练金句',
    title: '今天先把动作做扎实',
    body: `“${displayName.value}，真正的进步不是一次爆发，而是把每一次基本动作都做对。”`,
    footer: 'Coach Harris',
    tone: 'quote' as const
  },
  {
    id: 'recovery',
    eyebrow: '恢复建议',
    title: '补水和放松别落下',
    body: '开练前活动一下关节，训练后喝水并做两分钟放松拉伸。',
    footer: '恢复优先，明天会更稳。',
    tone: 'tip' as const
  }
])
onLoad((query) => {
  const nextQuery = query ?? {}
  reminderReturn.capture({
    tracking: nextQuery.tracking?.toString(),
    slot: nextQuery.slot?.toString(),
    date: nextQuery.date?.toString()
  })
})

onShow(async () => {
  await reminderReturn.resolvePending()
  if (reminderReturn.state.value.status === 'resolved') {
    store.setReminderSource('wechat-reminder')
  }
  await Promise.all([
    trainingProgress.refresh(),
    stationNotifications.refresh()
  ])
  void reminderConsent.loadStatus()
})

function handleReminderAuthorizationRetry() {
  void reminderConsent.authorize()
}
</script>

<template>
  <UniTrainingPageShell dock-tab="home">
    <view class="home-page">
      <TrainingHomeHeader
        :display-name="displayName"
        :reminder-label="reminderLabel"
        :unread-count="stationNotifications.unreadCount.value"
        :show-headline="false"
        :reminder-status="reminderConsent.status.value"
        :reminder-sync-state="reminderConsent.syncState.value"
        :reminder-working="reminderConsent.isWorking.value"
        mini-tag="训练首页"
        show-reminder-control
        variant="home"
        @open-notifications="stationNotifications.openList"
        @authorize-reminders="handleReminderAuthorizationRetry"
      />

      <QuestionnaireUnlockBanner
        v-if="isBrowseOnly"
        @continue-questionnaire="continueRequiredQuestionnaire"
      />

      <TrainingHomeProgressOverview
        v-if="progress"
        :completed-count="completedQuestCount"
        :goal-completed="progress.goalCompleted"
        :total-count="progress.modalities.length"
        :week-qualifying-day-count="weeklyQualifyingDayCount"
      />
      <view v-else class="home-page__progress-status">
        <text>{{ trainingProgress.state.value.status === 'error'
          ? trainingProgress.state.value.message
          : '正在同步训练概览…' }}</text>
      </view>

      <view class="home-page__section">
        <view class="home-page__section-copy">
          <text class="home-page__section-title">教练建议</text>
          <text class="home-page__section-subtitle">今天的重点和恢复建议，先看一眼再开练。</text>
        </view>

        <view class="home-page__feed">
          <TrainingHomeCoachCard
            v-for="card in coachCards"
            :key="card.id"
            :body="card.body"
            :eyebrow="card.eyebrow"
            :footer="card.footer"
            :title="card.title"
            :tone="card.tone"
          />
        </view>
      </view>

    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.home-page__section {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.home-page__progress-status {
  padding: 28rpx;
  border-radius: 32rpx;
  background: rgba(123, 135, 152, 0.08);
  color: #718096;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.5;
}

.home-page__section-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12rpx;
}

.home-page__section-title {
  display: block;
  color: #203042;
  font-size: 36rpx;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.home-page__section-subtitle {
  display: block;
  color: #7b8798;
  font-size: 22rpx;
  line-height: 1.48;
  font-weight: 600;
}

.home-page__feed {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

</style>
