<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import TrainingHomeCoachCard from '../../../components/training/TrainingHomeCoachCard.vue'
import TrainingHomeFeatureCard from '../../../components/training/TrainingHomeFeatureCard.vue'
import TrainingHomeHeader from '../../../components/training/TrainingHomeHeader.vue'
import TrainingHomeQuestPanel from '../../../components/training/TrainingHomeQuestPanel.vue'
import DailyProgressCard from '../../../components/training/DailyProgressCard.vue'
import ReminderAuthorizationStatus from '../../../components/training/ReminderAuthorizationStatus.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { useReminderConsent } from '../../composables/useReminderConsent'
import { useTrainingProgress } from '../../composables/useTrainingProgress'
import { useTrainingHomeProgressViewModel } from '../../composables/useTrainingHomeProgressViewModel'
import { useStationNotifications } from '../../composables/useStationNotifications'
import { useReminderReturn } from '../../composables/useReminderReturn'

const store = useStudentStore()
const trainingProgress = useTrainingProgress()
const reminderConsent = useReminderConsent()
const stationNotifications = useStationNotifications()
const reminderReturn = useReminderReturn()

const displayName = computed(() => store.state.profile.name.trim() || '同学')
const {
  progress,
  reminderLabel,
  quests,
  completedQuestCount,
  coachCards
} = useTrainingHomeProgressViewModel({
  progressState: trainingProgress.state,
  displayName
})
const learnCards = [
  {
    id: 'jump-shot',
    eyebrow: '基础动作',
    title: 'Perfect Jump Shot Arc',
    description: '抬肘、压腕、顺势出手，把动作感觉先找回来。',
    posterTone: 'sky' as const,
    timeLabel: '04:22'
  },
  {
    id: 'footwork',
    eyebrow: '移动训练',
    title: 'Advanced Crossover',
    description: '脚下先稳，再把横移和启动速度一点点提上去。',
    posterTone: 'sand' as const,
    timeLabel: '08:15'
  }
]

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
        mini-tag="TODAY'S QUEST"
        title="今天先完成主线任务"
        title-pill="训练首页"
        variant="home"
        @open-notifications="stationNotifications.openList"
      />

      <TrainingHomeQuestPanel
        v-if="progress"
        :completed-count="completedQuestCount"
        :quests="quests"
        :total-count="quests.length"
        title="今日任务"
      />

      <DailyProgressCard
        v-if="progress"
        :daily-count="progress.dailyCount"
        :modalities="progress.modalities"
        :week-qualifying-day-count="progress.week.qualifyingDayCount"
      />
      <view v-else-if="trainingProgress.state.value.status === 'error'" class="home-page__progress-status">
        <text>{{ trainingProgress.state.value.message }}</text>
      </view>
      <view v-else class="home-page__progress-status">
        <text>正在同步今日训练进度…</text>
      </view>

      <ReminderAuthorizationStatus
        :status="reminderConsent.status.value"
        :sync-state="reminderConsent.syncState.value"
        :is-working="reminderConsent.isWorking.value"
        @retry="handleReminderAuthorizationRetry"
      />

      <view class="home-page__section">
        <view class="home-page__section-head">
          <view class="home-page__section-copy">
            <text class="home-page__section-kicker">LEARN & PLAY</text>
            <text class="home-page__section-title">边练边学</text>
            <text class="home-page__section-subtitle">先看看动作提示，再带着感觉去训练。</text>
          </view>
          <navigator
            class="home-page__section-link"
            hover-class="home-page__section-link--pressed"
            url="/pages/growth/index"
          >
            <text>成长页</text>
          </navigator>
        </view>

        <view class="home-page__feed">
          <TrainingHomeFeatureCard
            v-for="card in learnCards"
            :key="card.id"
            :description="card.description"
            :eyebrow="card.eyebrow"
            :poster-tone="card.posterTone"
            :time-label="card.timeLabel"
            :title="card.title"
          />
        </view>
      </view>

      <view class="home-page__section">
        <view class="home-page__section-copy">
          <text class="home-page__section-kicker">COACH'S CORNER</text>
          <text class="home-page__section-title">教练角</text>
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

      <navigator
        class="home-page__cta"
        hover-class="home-page__cta--pressed"
        url="/pages/training/select"
      >
        <text>开始训练</text>
      </navigator>
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

.home-page__section {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.home-page__progress-status {
  padding: 28rpx 32rpx;
  border: 2rpx solid rgba(123, 135, 152, 0.16);
  border-radius: 24rpx;
  background: rgba(123, 135, 152, 0.06);
  color: #7b8798;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

.home-page__section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.home-page__section-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12rpx;
}

.home-page__section-kicker {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8rpx 16rpx;
  border-radius: 9999px;
  background: rgba(255, 236, 199, 0.32);
  color: #c69021;
  font-size: 18rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.home-page__section-title {
  display: block;
  color: #203042;
  font-size: 52rpx;
  line-height: 1.06;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.home-page__section-subtitle {
  display: block;
  color: #7b8798;
  font-size: 24rpx;
  line-height: 1.48;
  font-weight: 700;
}

.home-page__section-link {
  display: inline-flex;
  min-height: 52rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 10rpx 20rpx;
  border-radius: 9999px;
  background: rgba(184, 225, 255, 0.22);
  color: #7b94b1;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.home-page__section-link--pressed {
  transform: translateY(2rpx);
}

.home-page__feed {
  display: flex;
  flex-direction: column;
  gap: 34rpx;
}

.home-page__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 98rpx;
  margin-top: 20rpx;
  border-radius: 9999px;
  background: linear-gradient(135deg, #ff8088, #ff9a9e);
  box-shadow:
    0 18rpx 30rpx rgba(255, 128, 136, 0.24),
    0 12rpx 0 rgba(224, 111, 120, 0.9);
  color: #ffffff;
  font-size: 34rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-align: center;
}

.home-page__cta--pressed {
  transform: translateY(4rpx);
}
</style>
