<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { buildSessionBadge, resolveModalityLabel } from '../../../domain/student/sessionBadges'
import type { SessionRecord } from '../../../domain/student/types'
import { studentBackendSync } from '../../api/studentBackend'
import { useStudentStore } from '../../composables/useStudentStore'
import ImmersiveNavigationBar from '../../components/layout/ImmersiveNavigationBar.vue'

const store = useStudentStore()
const sessionId = shallowRef('latest')
const remoteSession = shallowRef<SessionRecord | null>(null)
const loadingSession = shallowRef(false)
const sessionLoadError = shallowRef('')

onLoad((query) => {
  const nextQuery = query ?? {}
  sessionId.value = nextQuery.sessionId?.toString() ?? 'latest'
  remoteSession.value = null

  void loadSession()
})

async function loadSession() {
  const localSession = resolveLocalSession()
  if (localSession || sessionId.value === 'latest' || loadingSession.value) {
    sessionLoadError.value = ''
    return
  }

  loadingSession.value = true
  sessionLoadError.value = ''
  try {
    const loaded = await studentBackendSync.loadTrainingSession(sessionId.value)
    if (!loaded) {
      sessionLoadError.value = '未找到这次训练记录'
      return
    }
    remoteSession.value = {
      id: loaded.id,
      modality: loaded.modality,
      date: loaded.date,
      completed: true,
      validCheckInApplied: false,
      restartedAfterInterrupt: false,
      shortQuestionnaire: null,
      analysis: {
        qualityScore: loaded.qualityScore,
        summary: loaded.summary,
        capturedBy: loaded.modality === 'stair' ? 'sensor' : 'camera'
      }
    }
  } catch {
    sessionLoadError.value = '训练记录加载失败，请检查网络后重试'
  } finally {
    loadingSession.value = false
  }
}

onShow(() => {
  store.refreshReminderEligibility()
})

function resolveLocalSession() {
  const snapshot = store.getSnapshot()
  if (sessionId.value === 'latest') {
    return snapshot.sessions.at(-1) ?? null
  }

  return snapshot.sessions.find(item => item.id === sessionId.value) ?? null
}

const session = computed(() => resolveLocalSession() ?? remoteSession.value)
const canReloadSession = computed(() => (
  Boolean(sessionLoadError.value) && sessionId.value !== 'latest'
))

const modalityLabel = computed(() => {
  if (!session.value) {
    return '本次训练'
  }

  return resolveModalityLabel(session.value.modality)
})

const qualityScore = computed<number | null>(() => session.value?.analysis.qualityScore ?? null)
const numericQualityScore = computed(() => qualityScore.value ?? 0)
const sessionBadge = computed(() => session.value ? buildSessionBadge(session.value) : null)
const previousComparableSession = computed(() => {
  if (!session.value) return null
  const sessions = store.getSnapshot().sessions
  const currentIndex = sessions.findIndex(item => item.id === session.value?.id)
  const earlierSessions = currentIndex >= 0 ? sessions.slice(0, currentIndex) : sessions.slice(0, -1)
  return earlierSessions.reverse().find(item => item.modality === session.value?.modality) ?? null
})
const scoreChangeLabel = computed(() => {
  const previousScore = previousComparableSession.value?.analysis.qualityScore
  if (qualityScore.value === null) {
    return '暂无可比较评分'
  }
  if (previousScore === undefined) return '首次训练基线'
  if (previousScore === null) return '暂无可比较评分'
  const difference = qualityScore.value - previousScore
  if (difference > 0) return `较上次提升 ${difference} 分`
  if (difference < 0) return `较上次 ${difference} 分`
  return '与上次持平'
})
const scoreChangeTone = computed(() => {
  const previousScore = previousComparableSession.value?.analysis.qualityScore
  if (qualityScore.value === null || previousScore === undefined || previousScore === null) return 'baseline'
  if (qualityScore.value > previousScore) return 'improved'
  if (qualityScore.value < previousScore) return 'declined'
  return 'steady'
})

const feedbackSummary = computed(() => (
  session.value?.analysis.summary?.trim() || '动作完成得很稳定，继续保持这个节奏。'
))

const encouragementTitle = computed(() => {
  if (qualityScore.value === null) {
    return '训练已完成'
  }
  if (numericQualityScore.value >= 85) {
    return '动作表现非常稳定'
  }

  if (numericQualityScore.value >= 70) {
    return '节奏已经进入状态'
  }

  return '继续调整动作细节'
})

const statusText = computed(() => {
  if (qualityScore.value === null) {
    return '本次暂无评分'
  }
  if (numericQualityScore.value >= 85) {
    return '本次状态优'
  }

  if (numericQualityScore.value >= 70) {
    return '本次状态良好'
  }

  return '建议继续练习'
})

const scoreDescription = computed(() => {
  if (qualityScore.value === null) {
    return '本次没有采集到足够的动作数据，但训练记录已经保存。'
  }
  if (numericQualityScore.value >= 85) {
    return '整体动作控制和完成度都很好，可以继续保持现在的训练状态。'
  }

  if (numericQualityScore.value >= 70) {
    return '基础动作已经完成得不错，继续稳定节奏会让整体表现更完整。'
  }

  return '先放慢一点节奏，优先保证动作准确性，再逐步提升强度。'
})

function goHome() {
  void uni.switchTab({
    url: '/pages/training/home'
  })
}

function goGrowthCenter() {
  void uni.switchTab({
    url: '/pages/growth/index'
  })
}

onShareAppMessage((options) => {
  const targetDataset = options.target?.dataset as { shareTitle?: string, sharePath?: string } | undefined

  return {
    title: targetDataset?.shareTitle ?? sessionBadge.value?.shareTitle ?? '我完成了一次 Sport Snack 训练',
    path: targetDataset?.sharePath ?? sessionBadge.value?.sharePath ?? '/pages/access/startup'
  }
})
</script>

<template>
  <view class="feedback-page">
    <ImmersiveNavigationBar title="训练反馈" show-back />
    <view class="feedback-page__inner">
      <view v-if="loadingSession" class="feedback-page__state-card">
        <text class="feedback-page__state-title">正在加载训练结果</text>
        <text class="feedback-page__state-copy">请稍候，不会用临时分数替代真实记录。</text>
      </view>

      <view v-else-if="!session" class="feedback-page__state-card">
        <text class="feedback-page__state-title">{{ sessionLoadError || '暂无可展示的训练结果' }}</text>
        <text class="feedback-page__state-copy">
          {{ canReloadSession ? '请检查网络后重新加载，结果不会以临时数据替代。' : '你可以返回训练首页开始一次新的训练。' }}
        </text>
        <view v-if="canReloadSession" class="feedback-page__state-actions">
          <button
            class="feedback-page__primary-action feedback-page__retry-action"
            type="button"
            hover-class="feedback-page__primary-action--pressed"
            @click="loadSession"
          >
            重新加载结果
          </button>
          <button
            class="feedback-page__secondary-action"
            type="button"
            hover-class="feedback-page__secondary-action--pressed"
            @click="goHome"
          >
            返回首页
          </button>
        </view>
        <button
          v-else
          class="feedback-page__primary-action"
          type="button"
          hover-class="feedback-page__primary-action--pressed"
          @click="goHome"
        >
          返回首页
        </button>
      </view>

      <template v-if="session && !loadingSession">
        <view class="feedback-page__hero">
          <view class="feedback-page__heading">
            <text class="feedback-page__eyebrow">训练已记录</text>
            <text class="feedback-page__title">{{ modalityLabel }}训练完成</text>
            <text class="feedback-page__subtitle">{{ statusText }}，结果已经为你保存。</text>
          </view>
        </view>

        <view class="feedback-page__score-card">
          <view class="feedback-page__score-summary">
            <text class="feedback-page__score-label">质量得分</text>
            <view class="feedback-page__score-value-row">
              <text class="feedback-page__score-value">{{ qualityScore === null ? '—' : qualityScore }}</text>
              <text class="feedback-page__score-unit">{{ qualityScore === null ? '暂无评分' : '/ 100' }}</text>
            </view>
          </view>

          <view class="feedback-page__score-detail">
            <view class="feedback-page__score-change" :class="`feedback-page__score-change--${scoreChangeTone}`">
              <text>{{ scoreChangeLabel }}</text>
            </view>
            <text class="feedback-page__score-copy">{{ scoreDescription }}</text>
          </view>
        </view>

        <view class="feedback-page__encouragement">
          <text class="feedback-page__encouragement-kicker">下一步</text>
          <text class="feedback-page__encouragement-title">{{ encouragementTitle }}</text>
          <text class="feedback-page__encouragement-copy">{{ feedbackSummary }}</text>
        </view>

        <view v-if="sessionBadge" class="feedback-page__badge-card">
          <view class="feedback-page__badge-visual" :class="`feedback-page__badge-visual--${sessionBadge.svgName}`">
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
              hover-class="feedback-page__share-action--pressed"
              open-type="share"
              :data-share-title="sessionBadge.shareTitle"
              :data-share-path="sessionBadge.sharePath"
            >
              <text>分享徽章</text>
            </button>
          </view>
        </view>

        <view class="feedback-page__actions">
          <button
            class="feedback-page__primary-action"
            type="button"
            hover-class="feedback-page__primary-action--pressed"
            @click="goHome"
          >
            <text>返回首页</text>
          </button>
          <button
            class="feedback-page__secondary-action"
            type="button"
            hover-class="feedback-page__secondary-action--pressed"
            @click="goGrowthCenter"
          >
            <text>查看成长中心</text>
          </button>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.feedback-page {
  --feedback-bg: #fcf7f0;
  --feedback-ink: #263442;
  --feedback-muted: #657284;
  --feedback-surface: #fffaf4;
  --feedback-subtle-surface: #f4ede4;
  --feedback-line: #ddd2c5;
  position: relative;
  min-height: 100vh;
  background: var(--feedback-bg);
  color: var(--feedback-ink);
}

.feedback-page__inner {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 48rpx 40rpx calc(56rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.feedback-page__state-card {
  display: flex;
  min-height: 360rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-top: 112rpx;
  padding: 48rpx 36rpx;
  border: 2rpx solid var(--feedback-line);
  border-radius: 28rpx;
  background: var(--feedback-surface);
  box-sizing: border-box;
  text-align: center;
}

.feedback-page__state-title {
  color: var(--feedback-ink);
  font-size: 34rpx;
  font-weight: 800;
}

.feedback-page__state-copy {
  color: var(--feedback-muted);
  font-size: 26rpx;
  line-height: 1.6;
}

.feedback-page__state-actions {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 12rpx;
}

.feedback-page__hero {
  display: flex;
  flex-direction: column;
}

.feedback-page__heading {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.feedback-page__eyebrow {
  color: #8f5e4c;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.feedback-page__title {
  color: var(--feedback-ink);
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.feedback-page__subtitle {
  max-width: 600rpx;
  color: var(--feedback-muted);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.55;
}

.feedback-page__score-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24rpx 32rpx;
  margin-top: 32rpx;
  padding: 28rpx 30rpx;
  border: 2rpx solid var(--feedback-line);
  border-radius: 28rpx;
  background: var(--feedback-subtle-surface);
}

.feedback-page__score-summary {
  display: flex;
  min-width: 176rpx;
  flex: 0 1 auto;
  flex-direction: column;
  gap: 10rpx;
}

.feedback-page__score-label {
  color: #5d6b79;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.2;
}

.feedback-page__score-value-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.feedback-page__score-value {
  color: var(--feedback-ink);
  font-size: 64rpx;
  font-weight: 900;
  letter-spacing: -0.055em;
  line-height: 0.92;
}

.feedback-page__score-unit {
  color: var(--feedback-muted);
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.2;
}

.feedback-page__score-detail {
  display: flex;
  min-width: 0;
  flex: 1 1 260rpx;
  flex-direction: column;
  gap: 14rpx;
}

.feedback-page__score-change {
  display: inline-flex;
  min-height: 48rpx;
  align-items: center;
  align-self: flex-start;
  padding: 0 14rpx;
  border: 2rpx solid #d2d9dd;
  border-radius: 9999px;
  background: #eff2f3;
  color: #4e5e6e;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 1.2;
}

.feedback-page__score-change--improved {
  border-color: #c9ded4;
  background: #eaf3ee;
  color: #356654;
}

.feedback-page__score-change--declined {
  border-color: #e4cec4;
  background: #fbefeb;
  color: #8a5146;
}

.feedback-page__score-copy {
  color: var(--feedback-muted);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.55;
}

.feedback-page__encouragement {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 32rpx;
  padding: 28rpx 0 0;
  border-top: 2rpx solid var(--feedback-line);
}

.feedback-page__encouragement-kicker {
  color: #8f5e4c;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.2;
}

.feedback-page__encouragement-title {
  color: var(--feedback-ink);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.3;
}

.feedback-page__encouragement-copy {
  color: var(--feedback-muted);
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.6;
}

.feedback-page__badge-card {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  margin-top: 32rpx;
  padding: 24rpx;
  border: 2rpx solid var(--feedback-line);
  border-radius: 28rpx;
  background: var(--feedback-surface);
}

.feedback-page__badge-visual {
  display: inline-flex;
  width: 92rpx;
  height: 92rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
}

.feedback-page__badge-visual--full-power {
  background: #eaf2f1;
  color: #365f54;
}

.feedback-page__badge-visual--stable-star {
  background: #f8efdf;
  color: #86651f;
}

.feedback-page__badge-visual--rhythm-spark {
  background: #eaf2f4;
  color: #3e6f7c;
}

.feedback-page__badge-visual--steady-seed {
  background: #f0ebe2;
  color: #6c5945;
}

.feedback-page__badge-mark {
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1;
}

.feedback-page__badge-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.feedback-page__badge-kicker {
  color: #8f5e4c;
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.2;
}

.feedback-page__badge-title {
  color: var(--feedback-ink);
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.28;
}

.feedback-page__badge-copy {
  color: var(--feedback-muted);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.48;
}

.feedback-page__share-action {
  display: inline-flex;
  width: 100%;
  min-height: 88rpx;
  align-items: center;
  justify-content: center;
  margin-top: 8rpx;
  padding: 0 20rpx;
  border: 2rpx solid #cfc3b4;
  border-radius: 9999px;
  background: #fffaf4;
  box-sizing: border-box;
  color: #394756;
  font-size: 24rpx;
  font-weight: 800;
}

.feedback-page__actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: auto;
  padding-top: 48rpx;
}

.feedback-page__primary-action,
.feedback-page__secondary-action {
  display: inline-flex;
  width: 100%;
  min-height: 100rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  box-sizing: border-box;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 1.2;
}

.feedback-page__primary-action {
  border: 2rpx solid var(--feedback-ink);
  background: var(--feedback-ink);
  color: #fffaf4;
}

.feedback-page__secondary-action {
  border: 2rpx solid #cfc3b4;
  background: var(--feedback-surface);
  color: #394756;
}

.feedback-page__primary-action--pressed {
  background: #1e2a36;
}

.feedback-page__secondary-action--pressed,
.feedback-page__share-action--pressed {
  background: #f4ede4;
}

.feedback-page__primary-action::after,
.feedback-page__secondary-action::after,
.feedback-page__share-action::after {
  display: none;
}

@media (max-height: 640px) {
  .feedback-page__inner {
    padding-top: 32rpx;
  }

  .feedback-page__score-card,
  .feedback-page__encouragement,
  .feedback-page__badge-card {
    margin-top: 24rpx;
  }

  .feedback-page__actions {
    padding-top: 32rpx;
  }
}
</style>
