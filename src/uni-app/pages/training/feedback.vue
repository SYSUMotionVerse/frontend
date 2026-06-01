<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { buildSessionBadge, resolveModalityLabel } from '../../../domain/student/sessionBadges'
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
    return '本次训练'
  }

  return resolveModalityLabel(session.value.modality)
})

const qualityScore = computed(() => session.value?.analysis.qualityScore ?? 0)
const sessionBadge = computed(() => session.value ? buildSessionBadge(session.value) : null)

const feedbackSummary = computed(() => (
  session.value?.analysis.summary?.trim() || '动作完成得很稳定，继续保持这个节奏。'
))

const encouragementTitle = computed(() => {
  if (qualityScore.value >= 85) {
    return '动作表现非常稳定'
  }

  if (qualityScore.value >= 70) {
    return '节奏已经进入状态'
  }

  return '继续调整动作细节'
})

const statusText = computed(() => {
  if (qualityScore.value >= 85) {
    return '本次状态优'
  }

  if (qualityScore.value >= 70) {
    return '本次状态良好'
  }

  return '建议继续练习'
})

const scoreDescription = computed(() => {
  if (qualityScore.value >= 85) {
    return '整体动作控制和完成度都很好，可以继续保持现在的训练状态。'
  }

  if (qualityScore.value >= 70) {
    return '基础动作已经完成得不错，继续稳定节奏会让整体表现更完整。'
  }

  return '先放慢一点节奏，优先保证动作准确性，再逐步提升强度。'
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

onShareAppMessage((options) => {
  const targetDataset = options.target?.dataset as { shareTitle?: string, sharePath?: string } | undefined

  return {
    title: targetDataset?.shareTitle ?? sessionBadge.value?.shareTitle ?? '我完成了一次 Sport Snack 训练',
    path: targetDataset?.sharePath ?? sessionBadge.value?.sharePath ?? '/pages/training/home'
  }
})
</script>

<template>
  <!-- Uses a bespoke result-page composition while staying in the UniAccessPageShell result-page family. -->
  <view class="feedback-page">
    <view class="feedback-page__halo feedback-page__halo--peach" />
    <view class="feedback-page__halo feedback-page__halo--sky" />

    <view class="feedback-page__inner">
      <view class="feedback-page__topbar">
        <text class="feedback-page__topbar-title">训练反馈</text>
      </view>

      <view class="feedback-page__hero">
        <view class="feedback-page__hero-badge">
          <text class="feedback-page__hero-emoji">🎉</text>
        </view>

        <view class="feedback-page__sticker">
          <text>{{ qualityScore >= 85 ? '太棒了！' : qualityScore >= 70 ? '继续加油！' : '再接再厉！' }}</text>
        </view>

        <view class="feedback-page__heading">
          <text class="feedback-page__headline">训练已完成</text>
          <text class="feedback-page__title">{{ modalityLabel }}反馈</text>
          <text class="feedback-page__subtitle">
            你的本次训练已记录完成，继续关注动作质量，训练效果会更稳定。
          </text>
        </view>
      </view>

      <view class="feedback-page__score-card">
        <view class="feedback-page__score-decor feedback-page__score-decor--left">
          <text>✦</text>
        </view>
        <view class="feedback-page__score-decor feedback-page__score-decor--right">
          <text>✦</text>
        </view>

        <text class="feedback-page__score-label">质量考评</text>
        <text class="feedback-page__score-value">{{ qualityScore }}</text>
        <text class="feedback-page__score-copy">{{ scoreDescription }}</text>
      </view>

      <view v-if="sessionBadge" class="feedback-page__badge-card">
        <view class="feedback-page__badge-visual" :class="`feedback-page__badge-visual--${sessionBadge.svgName}`">
          <view class="feedback-page__badge-ring" />
          <text class="feedback-page__badge-mark">
            {{ sessionBadge.svgName === 'full-power' ? '冠' : sessionBadge.svgName === 'stable-star' ? '星' : sessionBadge.svgName === 'rhythm-spark' ? '火' : '芽' }}
          </text>
        </view>

        <view class="feedback-page__badge-body">
          <text class="feedback-page__badge-kicker">本次获得徽章</text>
          <text class="feedback-page__badge-title">{{ sessionBadge.title }}</text>
          <text class="feedback-page__badge-copy">{{ sessionBadge.description }}</text>
          <button
            class="feedback-page__share-action"
            type="button"
            open-type="share"
            :data-share-title="sessionBadge.shareTitle"
            :data-share-path="sessionBadge.sharePath"
          >
            <text>分享徽章</text>
          </button>
        </view>
      </view>

      <view class="feedback-page__encouragement-card">
        <view class="feedback-page__encouragement-icon">
          <text>🌟</text>
        </view>

        <view class="feedback-page__encouragement-body">
          <text class="feedback-page__encouragement-title">{{ encouragementTitle }}</text>
          <text class="feedback-page__encouragement-copy">{{ feedbackSummary }}</text>
        </view>
      </view>

      <view class="feedback-page__status-pill">
        <text>{{ statusText }}</text>
      </view>

      <view class="feedback-page__actions">
        <button
          class="feedback-page__primary-action"
          type="button"
          @click="goHome"
        >
          <text>返回首页</text>
        </button>
        <button
          class="feedback-page__secondary-action"
          type="button"
          @click="goGrowthCenter"
        >
          <text>查看成长中心</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.feedback-page {
  --feedback-bg: #fcf6ef;
  --feedback-ink: #243245;
  --feedback-muted: #6f7e92;
  --feedback-coral: #ff8b73;
  --feedback-coral-shadow: #f46f5b;
  --feedback-sun: #ffd97c;
  --feedback-blue: #8fd6ff;
  --feedback-card: rgba(255, 255, 255, 0.92);
  --feedback-line: rgba(255, 255, 255, 0.95);
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(255, 217, 124, 0.32), transparent 28%),
    radial-gradient(circle at left 30%, rgba(143, 214, 255, 0.18), transparent 24%),
    var(--feedback-bg);
  color: var(--feedback-ink);
}

.feedback-page__halo {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
  filter: blur(4rpx);
}

.feedback-page__halo--peach {
  top: 132rpx;
  right: -48rpx;
  width: 220rpx;
  height: 220rpx;
  background: rgba(255, 180, 145, 0.24);
}

.feedback-page__halo--sky {
  left: -52rpx;
  top: 520rpx;
  width: 196rpx;
  height: 196rpx;
  background: rgba(143, 214, 255, 0.2);
}

.feedback-page__inner {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  padding: 48rpx 40rpx 88rpx;
}

.feedback-page__topbar {
  display: flex;
  justify-content: center;
  padding-top: 8rpx;
}

.feedback-page__topbar-title {
  font-size: 34rpx;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #2c3b4d;
}

.feedback-page__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 28rpx;
  text-align: center;
}

.feedback-page__hero-badge {
  display: inline-flex;
  width: 148rpx;
  height: 148rpx;
  align-items: center;
  justify-content: center;
  border: 8rpx solid var(--feedback-line);
  border-radius: 9999px;
  background: linear-gradient(180deg, #fff0ce 0%, #ffd684 100%);
  box-shadow: 0 18rpx 0 rgba(255, 197, 105, 0.34);
}

.feedback-page__hero-emoji {
  font-size: 72rpx;
}

.feedback-page__sticker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  padding: 14rpx 32rpx;
  border: 4rpx solid #fff8e8;
  border-radius: 9999px;
  background: var(--feedback-sun);
  box-shadow: 0 12rpx 0 rgba(255, 190, 84, 0.28);
  color: #6a4a00;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1;
  transform: rotate(-4deg);
}

.feedback-page__heading {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  margin-top: 36rpx;
}

.feedback-page__headline {
  font-size: 54rpx;
  font-weight: 900;
  line-height: 1.05;
  color: #263447;
}

.feedback-page__title {
  font-size: 48rpx;
  font-weight: 800;
  line-height: 1.08;
  color: #263447;
}

.feedback-page__subtitle {
  max-width: 620rpx;
  font-size: 29rpx;
  line-height: 1.7;
  color: var(--feedback-muted);
}

.feedback-page__score-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-top: 44rpx;
  padding: 42rpx 40rpx 46rpx;
  border: 6rpx solid rgba(255, 255, 255, 0.92);
  border-radius: 44rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, #fff4e8 100%);
  box-shadow: 0 20rpx 44rpx rgba(241, 167, 130, 0.14);
  text-align: center;
}

.feedback-page__score-decor {
  position: absolute;
  top: 46rpx;
  display: inline-flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 217, 124, 0.26);
  color: #f59b23;
  font-size: 28rpx;
  font-weight: 900;
}

.feedback-page__score-decor--left {
  left: 42rpx;
}

.feedback-page__score-decor--right {
  right: 42rpx;
}

.feedback-page__score-label {
  font-size: 30rpx;
  font-weight: 800;
  color: #7c8897;
}

.feedback-page__score-value {
  font-size: 144rpx;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: var(--feedback-coral);
  text-shadow: 0 10rpx 0 rgba(255, 139, 115, 0.12);
}

.feedback-page__score-copy {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--feedback-muted);
}

.feedback-page__badge-card {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 28rpx;
  padding: 30rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 40rpx;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, #fff8e9 100%);
  box-shadow: 0 16rpx 34rpx rgba(111, 126, 146, 0.08);
}

.feedback-page__badge-visual {
  position: relative;
  flex: 0 0 136rpx;
  display: inline-flex;
  width: 136rpx;
  height: 136rpx;
  align-items: center;
  justify-content: center;
  border-radius: 40rpx;
  overflow: hidden;
}

.feedback-page__badge-visual--full-power {
  background: linear-gradient(145deg, #89d6ff 0%, #ffd384 100%);
}

.feedback-page__badge-visual--stable-star {
  background: linear-gradient(145deg, #ffd384 0%, #ffad88 100%);
}

.feedback-page__badge-visual--rhythm-spark {
  background: linear-gradient(145deg, #a8e6cf 0%, #89d6ff 100%);
}

.feedback-page__badge-visual--steady-seed {
  background: linear-gradient(145deg, #d9b38c 0%, #a8e6cf 100%);
}

.feedback-page__badge-ring {
  position: absolute;
  inset: 20rpx;
  border: 8rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 9999px;
}

.feedback-page__badge-mark {
  position: relative;
  z-index: 1;
  color: #263447;
  font-size: 48rpx;
  font-weight: 900;
}

.feedback-page__badge-body {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
}

.feedback-page__badge-kicker {
  color: #2f78a9;
  font-size: 23rpx;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.feedback-page__badge-title {
  color: #263447;
  font-size: 34rpx;
  font-weight: 900;
}

.feedback-page__badge-copy {
  color: var(--feedback-muted);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.55;
}

.feedback-page__share-action {
  display: inline-flex;
  width: fit-content;
  min-height: 64rpx;
  align-items: center;
  justify-content: center;
  margin: 8rpx 0 0;
  padding: 0 28rpx;
  border: none;
  border-radius: 9999px;
  background: #263447;
  color: #fffaf2;
  font-size: 24rpx;
  font-weight: 900;
}

.feedback-page__encouragement-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 28rpx;
  padding: 28rpx 30rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.88);
  border-radius: 36rpx;
  background: var(--feedback-card);
  box-shadow: 0 16rpx 34rpx rgba(111, 126, 146, 0.08);
}

.feedback-page__encouragement-icon {
  flex: 0 0 96rpx;
  display: inline-flex;
  width: 96rpx;
  height: 96rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(180deg, #9fe0ff 0%, #77c9ff 100%);
  box-shadow: 0 12rpx 0 rgba(119, 201, 255, 0.24);
  font-size: 42rpx;
}

.feedback-page__encouragement-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.feedback-page__encouragement-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #263447;
}

.feedback-page__encouragement-copy {
  font-size: 27rpx;
  line-height: 1.65;
  color: var(--feedback-muted);
}

.feedback-page__status-pill {
  display: inline-flex;
  align-self: center;
  align-items: center;
  justify-content: center;
  margin-top: 30rpx;
  padding: 18rpx 34rpx;
  border: 4rpx solid rgba(186, 231, 255, 0.9);
  border-radius: 9999px;
  background: rgba(166, 224, 255, 0.4);
  color: #2f78a9;
  font-size: 28rpx;
  font-weight: 800;
}

.feedback-page__actions {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: auto;
  padding-top: 56rpx;
}

.feedback-page__primary-action,
.feedback-page__secondary-action {
  width: 100%;
  min-height: 98rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  font-size: 30rpx;
  font-weight: 800;
}

.feedback-page__primary-action {
  border: none;
  background: var(--feedback-coral);
  box-shadow: 0 14rpx 0 var(--feedback-coral-shadow);
  color: #ffffff;
}

.feedback-page__secondary-action {
  border: 4rpx solid rgba(255, 255, 255, 0.96);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12rpx 24rpx rgba(36, 50, 69, 0.06);
  color: #415366;
}

.feedback-page__primary-action::after,
.feedback-page__secondary-action::after,
.feedback-page__share-action::after {
  display: none;
}
</style>
