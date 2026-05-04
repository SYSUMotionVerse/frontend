<script setup lang="ts">
import { computed, unref } from 'vue'
import TrainingHomeHeader from '../../../components/training/TrainingHomeHeader.vue'
import TrainingModeCard from '../../../components/training/TrainingModeCard.vue'
import { DEFAULT_AVATAR_URL } from '../../../constants/defaultAvatar'
import type { TrainingModality } from '../../../domain/student/types'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { useProfileAvatarEditor } from '../../composables/useProfileAvatarEditor'
import { useStudentStore } from '../../composables/useStudentStore'

type TrainingModeSummary = {
  modality: TrainingModality
  title: string
  description: string
  duration: string
  difficulty: string
  cardIndex: number
  cardOffsetClass: string
  floatClass: string
  floatText: string
}

const trainingModes: TrainingModeSummary[] = [
  {
    modality: 'wushu',
    title: '武术（Wushu）',
    description: '跟着镜头提示舒展开动作，找到发力和节奏感。',
    duration: '10 分钟',
    difficulty: '中等',
    cardIndex: 0,
    cardOffsetClass: 'select-page__lane-item--flush',
    floatClass: 'select-page__float-block--spark',
    floatText: '流'
  },
  {
    modality: 'hiit',
    title: 'HIIT Blast',
    description: '用短促高能的间歇冲刺，把身体一下子唤醒。',
    duration: '15 分钟',
    difficulty: '挑战',
    cardIndex: 1,
    cardOffsetClass: 'select-page__lane-item--pull-right',
    floatClass: 'select-page__float-block--leaf',
    floatText: '芽'
  },
  {
    modality: 'stair',
    title: '跑楼梯（Stairs）',
    description: '配合传感器做轻快登阶，简单直接地把心率提起来。',
    duration: '8 分钟',
    difficulty: '轻松',
    cardIndex: 2,
    cardOffsetClass: 'select-page__lane-item--pull-left',
    floatClass: 'select-page__float-block--sun',
    floatText: '跃'
  }
]

const store = useStudentStore()
const avatarEditor = useProfileAvatarEditor()

const profileAvatarUrl = computed(() =>
  store.state.profile.avatarUrl.trim() || DEFAULT_AVATAR_URL
)

const displayName = computed(() => store.state.profile.name.trim() || '同学')

const reminderLabel = computed(() =>
  store.state.dailyAdherence.reminderEligible ? '18:00 提醒中' : '今日已达标'
)
const avatarUploadState = computed(() => unref(avatarEditor.uploadState) ?? 'idle')
const avatarErrorMessage = computed(() => unref(avatarEditor.errorMessage) ?? '')
const isWechatMiniProgram = computed(() => Boolean(unref(avatarEditor.isWechatMiniProgram)))
const supportsWechatAvatarSelection = computed(() => Boolean(unref(avatarEditor.supportsWechatAvatarSelection)))

function chooseMode(modality: TrainingModality) {
  if (modality === 'stair') {
    void uni.navigateTo({
      url: '/pages/training/stair-session'
    })
    return
  }

  void uni.navigateTo({
    url: `/pages/training/visual-session?modality=${modality}`
  })
}
</script>

<template>
  <UniTrainingPageShell dock-tab="playground">
    <view class="select-page">
      <TrainingHomeHeader
        :avatar-url="profileAvatarUrl"
        :display-name="displayName"
        :reminder-label="reminderLabel"
        :avatar-upload-state="avatarUploadState"
        :avatar-error-message="avatarErrorMessage"
        :is-wechat-mini-program="isWechatMiniProgram"
        :supports-wechat-avatar-selection="supportsWechatAvatarSelection"
        mini-tag="SELECT A SNACK"
        title="准备开练了吗？"
        title-pill="训练游乐场"
        variant="compact"
        @choose-wechat-avatar="avatarEditor.handleWechatAvatarChoice"
      />

      <view class="select-page__trail select-page__trail--top" />
      <view class="select-page__trail select-page__trail--bottom" />

      <view class="select-page__hero">
        <text class="select-page__hero-copy">
          今天想挑战哪一种训练小零食？每一关都很短，但会让身体马上热起来。
        </text>
      </view>

      <view class="select-page__lane">
        <view
          v-for="mode in trainingModes"
          :key="mode.modality"
          class="select-page__lane-item"
          :class="mode.cardOffsetClass"
        >
          <view class="select-page__float-block" :class="mode.floatClass">
            <text>{{ mode.floatText }}</text>
          </view>

          <TrainingModeCard
            :card-index="mode.cardIndex"
            :description="mode.description"
            :difficulty="mode.difficulty"
            :duration="mode.duration"
            :modality="mode.modality"
            :title="mode.title"
            @choose="chooseMode"
          />
        </view>
      </view>

      <view class="select-page__streak-card">
        <view class="select-page__streak-badge">
          <text>🔥</text>
        </view>
        <text class="select-page__streak-title">你正处在热身连击里</text>
        <text class="select-page__streak-copy">再完成 1 次训练，就能点亮 3 天连击。</text>
      </view>
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.select-page {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 44rpx;
  padding-bottom: 54rpx;
}

.select-page__trail {
  position: absolute;
  right: 12rpx;
  width: 132rpx;
  border-radius: 28rpx;
  background: rgba(249, 236, 210, 0.66);
  pointer-events: none;
}

.select-page__trail--top {
  top: 332rpx;
  height: 380rpx;
}

.select-page__trail--bottom {
  top: 946rpx;
  right: 34rpx;
  width: 88rpx;
  height: 300rpx;
  background: rgba(255, 244, 224, 0.74);
}

.select-page__hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 0 8rpx 8rpx;
}

.select-page__hero-copy {
  display: block;
  max-width: 580rpx;
  color: #667588;
  font-size: 26rpx;
  line-height: 1.58;
  font-weight: 700;
}

.select-page__lane {
  display: flex;
  flex-direction: column;
  gap: 52rpx;
}

.select-page__lane-item {
  position: relative;
  display: flex;
  width: 100%;
  flex-direction: column;
}

.select-page__lane-item--flush {
  padding-right: 32rpx;
}

.select-page__lane-item--pull-right {
  padding-left: 40rpx;
}

.select-page__lane-item--pull-left {
  padding-right: 28rpx;
}

.select-page__float-block {
  position: absolute;
  top: 64rpx;
  right: 6rpx;
  z-index: 2;
  display: flex;
  width: 126rpx;
  height: 126rpx;
  align-items: center;
  justify-content: center;
  border-radius: 26rpx;
  box-shadow: 0 16rpx 32rpx rgba(37, 47, 61, 0.05);
  font-size: 46rpx;
  font-weight: 900;
  pointer-events: none;
}

.select-page__float-block--spark {
  display: none;
}

.select-page__float-block--leaf {
  background: rgba(245, 238, 221, 0.96);
  color: #69814a;
}

.select-page__float-block--sun {
  top: 92rpx;
  right: 18rpx;
  width: 96rpx;
  height: 148rpx;
  border-radius: 52rpx 52rpx 18rpx 18rpx;
  background: rgba(252, 232, 198, 0.94);
  color: rgba(255, 255, 255, 0.85);
}

.select-page__streak-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-top: 10rpx;
  padding: 42rpx 36rpx;
  border-radius: 34rpx;
  background: linear-gradient(180deg, #ffd27a, #ffcc63);
  box-shadow:
    0 20rpx 42rpx rgba(222, 183, 95, 0.24),
    0 10rpx 0 rgba(233, 183, 70, 0.28);
  text-align: center;
}

.select-page__streak-badge {
  display: inline-flex;
  width: 74rpx;
  height: 74rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  color: #ff8758;
  font-size: 36rpx;
  box-shadow: 0 10rpx 24rpx rgba(255, 255, 255, 0.26);
}

.select-page__streak-title {
  display: block;
  color: #2f3746;
  font-size: 34rpx;
  line-height: 1.2;
  font-weight: 900;
}

.select-page__streak-copy {
  display: block;
  color: rgba(47, 55, 70, 0.76);
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 800;
}

</style>
