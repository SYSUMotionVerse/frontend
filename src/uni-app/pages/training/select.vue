<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed } from 'vue'
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
  duration: string
  difficulty: string
  actionHint: string
  routeLabel: string
  icon: string
  tone: 'wushu' | 'hiit' | 'stair'
  iconColor: string
}

const trainingModes: TrainingModeSummary[] = [
  {
    modality: 'wushu',
    title: '武术（Wushu）',
    duration: '按动作编排',
    difficulty: '中等',
    actionHint: '跟镜头出招',
    routeLabel: '镜头跟练',
    icon: 'camera-filled',
    tone: 'wushu',
    iconColor: '#c76b5b'
  },
  {
    modality: 'hiit',
    title: 'HIIT Blast',
    duration: '按动作编排',
    difficulty: '挑战',
    actionHint: '开始间歇冲刺',
    routeLabel: '镜头跟练',
    icon: 'fire-filled',
    tone: 'hiit',
    iconColor: '#2b7cb8'
  },
  {
    modality: 'stair',
    title: '跑楼梯（Stairs）',
    duration: '30 秒',
    difficulty: '轻松',
    actionHint: '拿起手机登阶',
    routeLabel: '传感器记录',
    icon: 'navigate-filled',
    tone: 'stair',
    iconColor: '#a76c1c'
  }
]

const store = useStudentStore()
const trainingProgress = useTrainingProgress()
const stationNotifications = useStationNotifications()
const accessState = useProtectedAccessState()
const isBrowseOnly = computed(() => accessState.value.level === 'browse')

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

const launchModes = computed(() => {
  const completionByModality = new Map(
    (progress.value?.modalities ?? []).map(item => [item.id, item.completed])
  )

  return trainingModes.map(mode => ({
    ...mode,
    completed: completionByModality.get(mode.modality) ?? false
  }))
})

const heroCopy = computed(() => {
  if (progress.value?.goalCompleted) {
    return '今天的三条跑道都点亮了，想继续练哪一条都可以。'
  }
  return '从还没点亮的赛道开始，直接开练。'
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
    url: `/subpackages/training/visual-session?modality=${modality}`
  })
}
</script>

<template>
  <UniTrainingPageShell dock-tab="playground">
    <view class="select-page">
      <TrainingHomeHeader
        :display-name="displayName"
        :reminder-label="reminderLabel"
        :unread-count="stationNotifications.unreadCount.value"
        :show-headline="false"
        mini-tag="训练游乐场"
        variant="home"
        @open-notifications="stationNotifications.openList"
      />

      <QuestionnaireUnlockBanner
        v-if="isBrowseOnly"
        compact
        @continue-questionnaire="continueRequiredQuestionnaire"
      />

      <view class="select-page__hero">
        <text class="select-page__hero-copy">{{ heroCopy }}</text>
      </view>

      <view class="select-page__launch-list" aria-label="选择并开始训练">
        <button
          v-for="mode in launchModes"
          :key="mode.modality"
          :class="[
            'select-page__launch-action',
            `select-page__launch-action--${mode.tone}`,
            { 'select-page__launch-action--locked': isBrowseOnly }
          ]"
          form-type="button"
          type="button"
          @click="chooseMode(mode.modality)"
        >
          <view :class="['select-page__launch-mark', `select-page__launch-mark--${mode.tone}`]">
            <uni-icons :type="mode.icon" size="30" :color="mode.iconColor" />
          </view>
          <view class="select-page__launch-copy">
            <view class="select-page__launch-title-row">
              <text class="select-page__launch-title">{{ mode.title }}</text>
              <text
                class="select-page__launch-completion"
                :class="{ 'select-page__launch-completion--done': mode.completed }"
              >
                {{ mode.completed ? '已完成' : '待完成' }}
              </text>
            </view>
            <text class="select-page__launch-hint">{{ mode.actionHint }}</text>
            <view class="select-page__launch-route">
            <text>{{ isBrowseOnly ? '完成问卷后解锁' : mode.routeLabel }}</text>
              <view :class="['select-page__launch-trail', `select-page__launch-trail--${mode.tone}`]">
                <view v-for="step in 3" :key="step" class="select-page__launch-trail-step" />
              </view>
            </view>
          </view>
          <view class="select-page__launch-meta">
            <text>{{ mode.duration }}</text>
            <text>{{ mode.difficulty }}</text>
          </view>
          <uni-icons type="right" size="18" :color="mode.iconColor" />
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
  gap: 40rpx;
  padding-bottom: 44rpx;
}

.select-page__hero {
  padding: 0 8rpx;
}

.select-page__hero-copy {
  display: block;
  color: #667588;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.58;
}

.select-page__launch-list {
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

.select-page__launch-action {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 176rpx;
  align-items: center;
  gap: 18rpx;
  padding: 30rpx 96rpx 30rpx 30rpx;
  border: none;
  color: #203042;
  overflow: hidden;
  text-align: left;
  transition: transform 160ms ease-out, opacity 160ms ease-out;
}

.select-page__launch-action::before {
  position: absolute;
  content: '';
  opacity: 0.7;
  pointer-events: none;
}

.select-page__launch-action::after { display: none; }

.select-page__launch-action--locked {
  opacity: 0.68;
}

.select-page__launch-action--wushu {
  margin-right: 20rpx;
  width: calc(100% - 20rpx);
  border-radius: 46rpx 46rpx 46rpx 20rpx;
  background: #fff0eb;
}

.select-page__launch-action--wushu::before {
  right: 124rpx;
  bottom: -60rpx;
  width: 104rpx;
  height: 104rpx;
  border: 8rpx solid rgba(231, 144, 134, 0.2);
  border-radius: 9999px;
  box-shadow: 36rpx -24rpx 0 -20rpx rgba(231, 144, 134, 0.4);
}

.select-page__launch-action--hiit {
  margin-left: 20rpx;
  width: calc(100% - 20rpx);
  border-radius: 24rpx 48rpx 24rpx 48rpx;
  background: #edf8fd;
}

.select-page__launch-action--hiit::before {
  right: 122rpx;
  bottom: 20rpx;
  width: 72rpx;
  height: 12rpx;
  border-radius: 9999px;
  background: rgba(105, 169, 205, 0.22);
  box-shadow: 20rpx -22rpx 0 -2rpx rgba(105, 169, 205, 0.2), 40rpx 20rpx 0 -1rpx rgba(105, 169, 205, 0.2);
}

.select-page__launch-action--stair {
  margin-right: 12rpx;
  width: calc(100% - 12rpx);
  border-radius: 50rpx 22rpx 50rpx 50rpx;
  background: #fff7e4;
}

.select-page__launch-action--stair::before {
  right: 128rpx;
  bottom: 12rpx;
  width: 18rpx;
  height: 26rpx;
  border-radius: 8rpx 8rpx 0 0;
  background: rgba(204, 153, 54, 0.22);
  box-shadow: 22rpx -16rpx 0 rgba(204, 153, 54, 0.2), 44rpx -32rpx 0 rgba(204, 153, 54, 0.18);
}

.select-page__launch-action:active {
  opacity: 0.76;
  transform: scale(0.98);
}

.select-page__launch-action:active .select-page__launch-trail-step {
  transform: translateY(-2rpx);
}

.select-page__launch-mark {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.76);
}

.select-page__launch-mark--wushu {
  border-radius: 30rpx 22rpx 30rpx 22rpx;
  box-shadow: 0 6rpx 0 rgba(231, 144, 134, 0.16);
}

.select-page__launch-mark--hiit {
  border-radius: 9999px;
  box-shadow: 0 6rpx 0 rgba(105, 169, 205, 0.16);
}

.select-page__launch-mark--stair {
  border-radius: 24rpx 34rpx 18rpx 34rpx;
  box-shadow: 0 6rpx 0 rgba(204, 153, 54, 0.16);
}

.select-page__launch-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
  padding-right: 12rpx;
  box-sizing: border-box;
}

.select-page__launch-title {
  color: #203042;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.24;
}

.select-page__launch-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
}

.select-page__launch-completion {
  display: inline-flex;
  min-height: 30rpx;
  flex: none;
  align-items: center;
  padding: 0 8rpx;
  border-radius: 9999px;
  background: rgba(255, 139, 139, 0.16);
  color: #c76b5b;
  font-size: 16rpx;
  font-weight: 900;
  line-height: 1.2;
}

.select-page__launch-completion--done {
  background: rgba(168, 230, 207, 0.42);
  color: #4f9070;
}

.select-page__launch-hint {
  color: #718096;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.4;
}

.select-page__launch-route {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 3rpx;
  color: #718096;
  font-size: 18rpx;
  font-weight: 800;
  line-height: 1;
}

.select-page__launch-trail {
  display: flex;
  width: 48rpx;
  height: 20rpx;
  align-items: center;
  gap: 5rpx;
}

.select-page__launch-trail-step {
  display: block;
  flex: none;
}

.select-page__launch-trail--wushu .select-page__launch-trail-step {
  width: 10rpx;
  height: 10rpx;
  border-radius: 9999px;
  background: #e99d95;
}

.select-page__launch-trail--wushu .select-page__launch-trail-step:nth-child(2) {
  transform: translateY(-5rpx);
}

.select-page__launch-trail--hiit {
  align-items: flex-end;
}

.select-page__launch-trail--hiit .select-page__launch-trail-step {
  width: 10rpx;
  border-radius: 8rpx 8rpx 2rpx 2rpx;
  background: #7db5d7;
}

.select-page__launch-trail--hiit .select-page__launch-trail-step:nth-child(1) { height: 8rpx; }
.select-page__launch-trail--hiit .select-page__launch-trail-step:nth-child(2) { height: 18rpx; }
.select-page__launch-trail--hiit .select-page__launch-trail-step:nth-child(3) { height: 12rpx; }

.select-page__launch-trail--stair {
  align-items: flex-end;
  gap: 2rpx;
}

.select-page__launch-trail--stair .select-page__launch-trail-step {
  width: 14rpx;
  border-radius: 6rpx 6rpx 0 0;
  background: #d8a84e;
}

.select-page__launch-trail--stair .select-page__launch-trail-step:nth-child(1) { height: 7rpx; }
.select-page__launch-trail--stair .select-page__launch-trail-step:nth-child(2) { height: 12rpx; }
.select-page__launch-trail--stair .select-page__launch-trail-step:nth-child(3) { height: 18rpx; }

.select-page__launch-meta {
  position: absolute;
  right: 64rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
  color: #718096;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.2;
}

.select-page__launch-action > .uni-icons {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
}

.select-page__streak-note {
  display: block;
  padding: 4rpx 8rpx 0;
  color: #718096;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
}
</style>
