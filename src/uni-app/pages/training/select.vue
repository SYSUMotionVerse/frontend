<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TrainingHomeHeader from '../../../components/training/TrainingHomeHeader.vue'
import QuestionnaireUnlockBanner from '../../../components/access/QuestionnaireUnlockBanner.vue'
import type { TrainingModality } from '../../../domain/student/types'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'
import { useStationNotifications } from '../../composables/useStationNotifications'
import { useTrainingProgress } from '../../composables/useTrainingProgress'
import { useTrainingHomeProgressViewModel } from '../../composables/useTrainingHomeProgressViewModel'
import {
  continueRequiredQuestionnaire,
  ensureProtectedStudentAccess,
  useProtectedAccessState
} from '../../composables/useNavigationGuard'

type TrainingModeSummary = {
  modality: TrainingModality
  title: string
  actionHint: string
  routeLabel: string
  icon: string
  iconColor: string
  tone: 'coral' | 'teal' | 'gold'
}

type TrainingModeStatus = 'recommended' | 'pending' | 'completed' | 'locked' | 'syncing'

type TrainingLaunchMode = TrainingModeSummary & {
  status: TrainingModeStatus
  statusLabel: string
  actionLabel: string
}

const modeStatusLabels: Record<TrainingModeStatus, string> = {
  recommended: '推荐',
  pending: '待完成',
  completed: '已完成',
  locked: '问卷未解锁',
  syncing: '进度同步中'
}

const modeActionLabels: Record<TrainingModeStatus, string> = {
  recommended: '开始',
  pending: '进入',
  completed: '再练',
  locked: '解锁',
  syncing: '开始'
}

const trainingModes: TrainingModeSummary[] = [
  {
    modality: 'wushu',
    title: '武术',
    actionHint: '跟镜头出招',
    routeLabel: '镜头跟练',
    icon: 'camera-filled',
    iconColor: '#c76b5b',
    tone: 'coral'
  },
  {
    modality: 'hiit',
    title: '自重抗阻',
    actionHint: '开始间歇冲刺',
    routeLabel: '镜头跟练',
    icon: 'fire-filled',
    iconColor: '#2b7cb8',
    tone: 'teal'
  },
  {
    modality: 'stair',
    title: '跑楼梯',
    actionHint: '拿起手机登阶',
    routeLabel: '传感器记录',
    icon: 'navigate-filled',
    iconColor: '#a76c1c',
    tone: 'gold'
  }
]

const store = useStudentStore()
const trainingProgress = useTrainingProgress()
const stationNotifications = useStationNotifications()
const accessState = useProtectedAccessState()
const isBrowseOnly = computed(() => accessState.value.level === 'browse')
const isRefreshing = ref(false)

const displayName = computed(() => store.state.profile.name.trim() || '同学')
const {
  progress,
  reminderLabel
} = useTrainingHomeProgressViewModel({
  progressState: trainingProgress.state,
  displayName
})

onShow(() => {
  void Promise.all([
    trainingProgress.refresh(),
    stationNotifications.refresh()
  ])
})

async function handlePullDownRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      trainingProgress.refresh({ force: true }),
      stationNotifications.refresh({ force: true })
    ])
  } finally {
    isRefreshing.value = false
  }
}

const launchModes = computed(() => {
  const completionByModality = new Map(
    (progress.value?.modalities ?? []).map(item => [item.id, item.completed])
  )
  const firstPendingModality = progress.value
    ? progress.value.modalities.find(item => !item.completed)?.id
    : undefined

  const modes = trainingModes.map<TrainingLaunchMode>(mode => {
    const completed = completionByModality.get(mode.modality)
    const hasAuthoritativeStatus = completed !== undefined
    const status: TrainingModeStatus = isBrowseOnly.value
      ? 'locked'
      : !progress.value || !hasAuthoritativeStatus
        ? 'syncing'
        : completed
          ? 'completed'
          : mode.modality === firstPendingModality
            ? 'recommended'
            : 'pending'

    return {
      ...mode,
      status,
      statusLabel: modeStatusLabels[status],
      actionLabel: modeActionLabels[status]
    }
  })

  return firstPendingModality
    ? [...modes].sort((left, right) =>
        Number(right.status === 'recommended') - Number(left.status === 'recommended'))
    : modes
})

const heroCopy = computed(() => {
  if (isBrowseOnly.value) {
    return '先完成问卷，解锁适合你的训练。'
  }
  const recommendedMode = launchModes.value.find(mode => mode.status === 'recommended')
  if (recommendedMode) {
    return `推荐先做${recommendedMode.title}，完成后点亮今日进度。`
  }
  if (progress.value?.goalCompleted) {
    return '今天的训练已完成，按自己的节奏选择加练。'
  }
  return progress.value
    ? '选择一项训练，继续完成今天的安排。'
    : '选择一项训练，进度同步后会标出下一项推荐。'
})

async function chooseMode(modality: TrainingModality) {
  if (isBrowseOnly.value) {
    continueRequiredQuestionnaire()
    return
  }

  const canExecute = await ensureProtectedStudentAccess('execute')
  if (!canExecute) return

  if (modality === 'stair') {
    void uni.navigateTo({ url: '/pages/training/stair-session' })
    return
  }

  void uni.navigateTo({
    url: `/pages/training/exercise-sets?modality=${modality}`
  })
}
</script>

<template>
  <UniTrainingPageShell
    dock-tab="playground"
    page-title="选择训练"
    refresh-enabled
    :refreshing="isRefreshing"
    @refresh="handlePullDownRefresh"
  >
    <view class="select-page">
      <TrainingHomeHeader
        :display-name="displayName"
        :reminder-label="reminderLabel"
        :unread-count="stationNotifications.unreadCount.value"
        :show-headline="false"
        :show-status="false"
        mini-tag="选择今天要完成的训练"
        mini-tag-tone="muted"
        variant="home"
        @open-notifications="stationNotifications.openList"
      />

      <QuestionnaireUnlockBanner
        v-if="isBrowseOnly"
        compact
        @continue-questionnaire="continueRequiredQuestionnaire"
      />

      <view class="select-page__hero">
        <text class="select-page__eyebrow">今日训练</text>
        <text class="select-page__hero-copy">{{ heroCopy }}</text>
      </view>

      <view class="select-page__launch-list" aria-label="选择并开始训练">
        <button
          v-for="mode in launchModes"
          :key="mode.modality"
          :class="[
            'select-page__launch-action',
            `select-page__launch-action--${mode.status}`,
            `select-page__launch-action--${mode.tone}`
          ]"
          form-type="button"
          type="button"
          :aria-label="`${mode.title}，${mode.statusLabel}。${mode.actionHint}`"
          @click="chooseMode(mode.modality)"
        >
          <view :class="['select-page__launch-mark', `select-page__launch-mark--${mode.tone}`]">
            <uni-icons :type="mode.icon" size="20" :color="mode.iconColor" />
          </view>
          <view class="select-page__launch-copy">
            <text class="select-page__launch-title">{{ mode.title }}</text>
            <text class="select-page__launch-hint">{{ mode.actionHint }}</text>
            <view class="select-page__launch-route">
              <text>{{ mode.routeLabel }}</text>
              <text
                :class="[
                  'select-page__launch-status',
                  `select-page__launch-status--${mode.status}`
                ]"
              >
                · {{ mode.statusLabel }}
              </text>
            </view>
          </view>
          <view class="select-page__launch-enter" aria-hidden="true">
            <text
              :class="{ 'select-page__launch-enter--recommended': mode.status === 'recommended' }"
            >
              {{ mode.actionLabel }}
            </text>
            <uni-icons
              type="right"
              size="15"
              :color="mode.status === 'recommended' ? '#c76b5b' : '#8a97a8'"
            />
          </view>
        </button>
      </view>

      <view class="select-page__streak-note">
        <text>完成任一训练后，将更新今日达标状态。</text>
      </view>
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.select-page {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  padding-bottom: 0;
}

.select-page__hero {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 6rpx 10rpx 0;
}

.select-page__eyebrow {
  display: block;
  color: #c76b5b;
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.select-page__hero-copy {
  display: block;
  max-width: 640rpx;
  color: #718096;
  font-size: 25rpx;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.5;
}

.select-page__launch-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.select-page__launch-action {
  display: flex;
  width: 100%;
  min-height: 164rpx;
  align-items: center;
  gap: 24rpx;
  box-sizing: border-box;
  padding: 26rpx 28rpx;
  border: 2rpx solid rgba(196, 151, 78, 0.42);
  border-radius: 28rpx;
  background: rgba(255, 250, 244, 0.9);
  box-shadow:
    0 10rpx 24rpx rgba(71, 56, 39, 0.1),
    0 2rpx 0 rgba(196, 151, 78, 0.12);
  color: #203042;
  text-align: left;
  transition: background-color 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out, opacity 160ms ease-out;
}

.select-page__launch-action::after {
  border: none;
}

.select-page__launch-action--recommended {
  border-color: rgba(214, 99, 99, 0.42);
  background: rgba(255, 226, 225, 0.78);
}

.select-page__launch-action--teal:not(.select-page__launch-action--recommended) {
  border-color: rgba(72, 143, 183, 0.34);
  background: rgba(243, 249, 252, 0.9);
}

.select-page__launch-action--gold:not(.select-page__launch-action--recommended) {
  border-color: rgba(196, 151, 78, 0.42);
  background: rgba(255, 250, 239, 0.92);
}

.select-page__launch-action:active {
  opacity: 0.76;
  box-shadow: 0 4rpx 12rpx rgba(71, 56, 39, 0.08);
  transform: scale(0.985);
}

.select-page__launch-action--locked {
  background: #faf5ef;
  opacity: 0.82;
}

.select-page__launch-mark {
  display: flex;
  width: 70rpx;
  height: 70rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
}

.select-page__launch-mark--coral { background: #ffe8e5; }
.select-page__launch-mark--teal { background: #e0f1f8; }
.select-page__launch-mark--gold { background: #fff1cf; }

.select-page__launch-action--recommended .select-page__launch-mark--coral {
  background: rgba(255, 255, 255, 0.68);
}

.select-page__launch-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
  box-sizing: border-box;
}

.select-page__launch-title {
  color: #203042;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.24;
}

.select-page__launch-hint {
  color: #718096;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.4;
}

.select-page__launch-route {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 2rpx;
  color: #8a97a8;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.3;
}

.select-page__launch-status {
  color: #c76b5b;
}

.select-page__launch-status--completed {
  color: #2b7cb8;
}

.select-page__launch-status--pending,
.select-page__launch-status--syncing {
  color: #718096;
}

.select-page__launch-status--locked {
  color: #a76c1c;
}

.select-page__launch-enter {
  display: inline-flex;
  min-height: 56rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  color: #8a97a8;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.select-page__launch-enter--recommended {
  color: #c76b5b;
}

.select-page__streak-note {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 8rpx 0;
  color: rgba(113, 128, 150, 0.72);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
}
</style>
