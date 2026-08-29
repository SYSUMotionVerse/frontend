<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import TrainingHomeCoachCard from '../../../components/training/TrainingHomeCoachCard.vue'
import TrainingHomeHeader from '../../../components/training/TrainingHomeHeader.vue'
import TrainingHomeProgressOverview from '../../../components/training/TrainingHomeProgressOverview.vue'
import TrainingReminderAuthorizationCard from '../../../components/training/TrainingReminderAuthorizationCard.vue'
import QuestionnaireUnlockBanner from '../../../components/access/QuestionnaireUnlockBanner.vue'
import type { TrainingModality } from '../../../domain/student/types'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { useReminderConsent } from '../../composables/useReminderConsent'
import { useStationNotifications } from '../../composables/useStationNotifications'
import { useReminderReturn } from '../../composables/useReminderReturn'
import { useTrainingProgress } from '../../composables/useTrainingProgress'
import { useTrainingHomeProgressViewModel } from '../../composables/useTrainingHomeProgressViewModel'
import { prefetchGrowthOverview } from '../../composables/useGrowthOverview'
import {
  continueRequiredQuestionnaire,
  ensureProtectedStudentAccess,
  useProtectedAccessState
} from '../../composables/useNavigationGuard'

const store = useStudentStore()
const reminderConsent = useReminderConsent()
const stationNotifications = useStationNotifications()
const reminderReturn = useReminderReturn()
const trainingProgress = useTrainingProgress()
const accessState = useProtectedAccessState()
const isBrowseOnly = computed(() => accessState.value.level === 'browse')
const isRefreshing = ref(false)
const hasLoadedReminderStatus = ref(false)
let hasStartedPrimaryTabPrefetch = false

const displayName = computed(() => store.state.profile.name.trim() || '同学')
const {
  progress,
  reminderLabel,
  quests,
  completedQuestCount,
  weeklyQualifyingDayCount,
  coachCards
} = useTrainingHomeProgressViewModel({
  progressState: trainingProgress.state,
  displayName
})

const trainingHints: Record<TrainingModality, string> = {
  wushu: '跟着示范完成一轮动作训练。',
  hiit: '准备一轮间歇动作训练。',
  stair: '准备好后开始 30 秒连续上楼。'
}

const trainingVisuals: Record<TrainingModality, {
  icon: 'camera-filled' | 'fire-filled' | 'navigate-filled'
  iconColor: string
  tone: 'coral' | 'teal' | 'gold'
}> = {
  wushu: {
    icon: 'camera-filled',
    iconColor: '#c76b5b',
    tone: 'coral'
  },
  hiit: {
    icon: 'fire-filled',
    iconColor: '#2b7cb8',
    tone: 'teal'
  },
  stair: {
    icon: 'navigate-filled',
    iconColor: '#a76c1c',
    tone: 'gold'
  }
}

const nextTraining = computed(() => {
  const nextQuest = quests.value.find(quest => quest.highlight)
  if (!nextQuest) return null

  return {
    ...nextQuest,
    hint: trainingHints[nextQuest.id],
    ...trainingVisuals[nextQuest.id]
  }
})

const nextActionLabel = computed(() => {
  if (!nextTraining.value) return ''
  if (isBrowseOnly.value) return '去解锁'
  return '开始'
})

const nextActionAriaLabel = computed(() => {
  const next = nextTraining.value
  if (!next) return ''
  return isBrowseOnly.value
    ? `完成问卷以解锁${next.title}`
    : `开始${next.title}`
})
const showReminderAuthorizationCard = computed(() => (
  hasLoadedReminderStatus.value
  && reminderConsent.syncState.value !== 'failed'
  && ['not_requested', 'rejected', 'banned', 'unsupported'].includes(
    reminderConsent.status.value
  )
))
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
  if (!hasStartedPrimaryTabPrefetch) {
    hasStartedPrimaryTabPrefetch = true
    void prefetchGrowthOverview({
      sections: ['history', 'adherence', 'physicalMetrics', 'awards']
    })
  }
  if (!hasLoadedReminderStatus.value) {
    await reminderConsent.loadStatus()
    hasLoadedReminderStatus.value = true
  }
})

async function handlePullDownRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      trainingProgress.refresh({ force: true }),
      stationNotifications.refresh({ force: true }),
      reminderConsent.loadStatus()
    ])
    hasLoadedReminderStatus.value = true
  } finally {
    isRefreshing.value = false
  }
}

async function startNextTraining() {
  const next = nextTraining.value
  if (!next) return

  if (isBrowseOnly.value) {
    continueRequiredQuestionnaire()
    return
  }

  const canExecute = await ensureProtectedStudentAccess('execute')
  if (!canExecute) return

  if (next.id === 'stair') {
    void uni.navigateTo({ url: '/pages/training/stair-session' })
    return
  }

  void uni.navigateTo({
    url: `/pages/training/exercise-sets?modality=${next.id}`
  })
}

function authorizeTrainingReminders() {
  void reminderConsent.authorize()
}
</script>

<template>
  <UniTrainingPageShell
    dock-tab="home"
    page-title="训练首页"
    refresh-enabled
    :refreshing="isRefreshing"
    @refresh="handlePullDownRefresh"
  >
    <view class="home-page">
      <TrainingHomeHeader
        :display-name="displayName"
        :reminder-label="reminderLabel"
        :unread-count="stationNotifications.unreadCount.value"
        :show-headline="false"
        :show-status="false"
        mini-tag="新的一天，加油开始吧！"
        mini-tag-tone="muted"
        variant="home"
        @open-notifications="stationNotifications.openList"
      />

      <QuestionnaireUnlockBanner
        v-if="isBrowseOnly"
        @continue-questionnaire="continueRequiredQuestionnaire"
      />

      <button
        v-if="nextTraining"
        class="home-next-action home-next-action__button"
        type="button"
        form-type="button"
        hover-class="home-next-action--pressed"
        :aria-label="nextActionAriaLabel"
        :data-training-modality="nextTraining.id"
        @click="startNextTraining"
      >
        <text class="home-next-action__eyebrow">
          今日下一项
        </text>
        <view :class="['home-next-action__mark', `home-next-action__mark--${nextTraining.tone}`]">
          <uni-icons :type="nextTraining.icon" size="20" :color="nextTraining.iconColor" />
        </view>
        <view class="home-next-action__copy">
          <text class="home-next-action__title">{{ nextTraining.title }}</text>
          <text class="home-next-action__detail">
            {{ isBrowseOnly ? '完成问卷后即可开始今天的训练。' : nextTraining.hint }}
          </text>
        </view>
        <view class="home-next-action__enter" aria-hidden="true">
          <text>{{ nextActionLabel }}</text>
          <uni-icons type="right" size="16" color="#fffaf4" />
        </view>
      </button>

      <view v-else-if="progress?.goalCompleted" class="home-next-action home-next-action--complete">
        <text class="home-next-action__eyebrow">今日训练已完成</text>
        <text class="home-next-action__complete-copy">三项训练都已记录，按自己的节奏恢复和补水。</text>
      </view>

      <TrainingReminderAuthorizationCard
        v-if="showReminderAuthorizationCard"
        :working="reminderConsent.isWorking.value"
        @authorize="authorizeTrainingReminders"
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
        <view class="home-page__feed">
          <TrainingHomeCoachCard
            v-for="card in coachCards"
            :key="card.id"
            :body="card.body"
            :eyebrow="card.eyebrow"
            :footer="card.footer"
            :title="card.title"
          />
        </view>
      </view>

    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.home-page {
  --home-ink: #203042;
  --home-muted: #718096;
  --home-surface: #fffaf4;
  display: flex;
  flex-direction: column;
  gap: 34rpx;
  padding-bottom: 20rpx;
}

.home-next-action {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 172rpx;
  margin: 0;
  padding: 58rpx 34rpx 28rpx;
  align-items: center;
  gap: 26rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 40rpx;
  background: var(--home-surface);
  box-sizing: border-box;
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
  color: var(--home-ink);
  text-align: left;
  transition: background-color 160ms ease-out, opacity 160ms ease-out, transform 160ms ease-out;
}

.home-next-action::after { display: none; }

.home-next-action--complete {
  width: auto;
  min-height: 0;
  padding: 28rpx 30rpx;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
  background: rgba(255, 255, 255, 0.94);
}

.home-next-action--pressed {
  opacity: 0.76;
  transform: scale(0.985);
}

.home-next-action__mark {
  display: inline-flex;
  width: 76rpx;
  height: 76rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
}

.home-next-action__mark--coral { background: #ffe8e5; }
.home-next-action__mark--teal { background: #e0f1f8; }
.home-next-action__mark--gold { background: #fff1cf; }

.home-next-action__button {
  line-height: normal;
}

.home-next-action__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.home-next-action--complete .home-next-action__eyebrow {
  position: static;
}

.home-next-action__eyebrow {
  position: absolute;
  top: 24rpx;
  left: 34rpx;
  display: block;
  color: #c76b5b;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.25;
}

.home-next-action__title {
  display: block;
  color: var(--home-ink);
  font-size: 32rpx;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.24;
}

.home-next-action__detail,
.home-next-action__complete-copy {
  display: block;
  color: var(--home-muted);
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.48;
}

.home-next-action__enter {
  display: inline-flex;
  min-width: 132rpx;
  min-height: 76rpx;
  flex: none;
  align-self: center;
  align-items: center;
  gap: 6rpx;
  margin-left: auto;
  justify-content: center;
  border-radius: 9999px;
  background: #ff6f77;
  color: #fffaf4;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.2;
  padding: 0 18rpx;
}

.home-page__section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-top: 4rpx;
}

.home-page__progress-status {
  padding: 30rpx 32rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 44rpx;
  background: var(--home-surface);
  color: var(--home-muted);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.48;
}

.home-page__section-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12rpx;
}

.home-page__section-title {
  display: block;
  color: var(--home-ink);
  font-size: 32rpx;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.home-page__section-subtitle {
  display: block;
  color: var(--home-muted);
  font-size: 22rpx;
  line-height: 1.48;
  font-weight: 600;
}

.home-page__feed {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

</style>
