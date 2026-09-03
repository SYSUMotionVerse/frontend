<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { buildSessionBadge, resolveModalityLabel } from '../../../domain/student/sessionBadges'
import type { ScoredActionResult } from '../../../domain/training/actionScoringTypes'
import type { SessionRecord } from '../../../domain/student/types'
import TrainingFeedbackActionCard from '../../../components/training/TrainingFeedbackActionCard.vue'
import TrainingFeedbackBodyMap from '../../../components/training/TrainingFeedbackBodyMap.vue'
import TrainingFeedbackTrendChart from '../../../components/training/TrainingFeedbackTrendChart.vue'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import UniPageHeading from '../../components/layout/UniPageHeading.vue'
import { studentBackendSync } from '../../api/studentBackend'
import type { GrowthTrainingHistoryItem, GrowthVisualScoreTrendModel } from '../../api/studentBackendTypes'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const sessionId = shallowRef('latest')
const remoteSession = shallowRef<SessionRecord | null>(null)
const loadingSession = shallowRef(false)
const sessionLoadError = shallowRef('')
const historySessions = shallowRef<GrowthTrainingHistoryItem[]>([])
const scoreTrend = shallowRef<GrowthVisualScoreTrendModel | null>(null)
const expandedActionKey = shallowRef('')

const angleKeys = new Set([
  'left_elbow', 'right_elbow', 'left_shoulder', 'right_shoulder',
  'left_hip', 'right_hip', 'left_knee', 'right_knee', 'torso_rotation'
])

onLoad((query) => {
  sessionId.value = query?.sessionId?.toString() ?? 'latest'
  remoteSession.value = null
  void Promise.all([loadSession(), loadHistoryContext()])
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
        capturedBy: loaded.modality === 'stair' ? 'sensor' : 'camera',
        scoreDetails: loaded.scoreDetails ?? null
      }
    }
  } catch {
    sessionLoadError.value = '训练记录加载失败，请检查网络后重试'
  } finally {
    loadingSession.value = false
  }
}

async function loadHistoryContext() {
  try {
    const [history, trend] = await Promise.all([
      studentBackendSync.loadGrowthHistory(),
      studentBackendSync.loadVisualScoreTrend()
    ])
    historySessions.value = history.trainingSessions
    scoreTrend.value = trend
  } catch {
    historySessions.value = []
    scoreTrend.value = null
  }
}

onShow(() => store.refreshReminderEligibility())

function resolveLocalSession() {
  const snapshot = store.getSnapshot()
  if (sessionId.value === 'latest') return snapshot.sessions.at(-1) ?? null
  return snapshot.sessions.find(item => item.id === sessionId.value) ?? null
}

const session = computed(() => resolveLocalSession() ?? remoteSession.value)
const canReloadSession = computed(() => Boolean(sessionLoadError.value) && sessionId.value !== 'latest')
const modalityLabel = computed(() => session.value ? resolveModalityLabel(session.value.modality) : '本次训练')
const qualityScore = computed<number | null>(() => session.value?.analysis.qualityScore ?? null)
const numericQualityScore = computed(() => qualityScore.value ?? 0)
const sessionBadge = computed(() => session.value ? buildSessionBadge(session.value) : null)
const feedbackSummary = computed(() => session.value?.analysis.summary?.trim() || '训练已记录，继续保持现在的节奏。')
const scoreDimensions = computed(() => session.value?.analysis.scoreDetails?.dimensions ?? [])
const actionResults = computed(() => session.value?.analysis.scoreDetails?.actionResults ?? [])
const overallAngles = computed(() => scoreDimensions.value.filter(dimension => angleKeys.has(dimension.key)))

const previousComparableSession = computed(() => {
  if (!session.value) return null
  const sessions = store.getSnapshot().sessions
  const currentIndex = sessions.findIndex(item => item.id === session.value?.id)
  const earlier = currentIndex >= 0 ? sessions.slice(0, currentIndex) : sessions.slice(0, -1)
  return earlier.reverse().find(item => item.modality === session.value?.modality) ?? null
})

const scoreChangeLabel = computed(() => {
  const previousScore = previousComparableSession.value?.analysis.qualityScore
  if (qualityScore.value === null) return '暂无可比较评分'
  if (previousScore === undefined) return '首次训练基线'
  if (previousScore === null) return '暂无可比较评分'
  const difference = qualityScore.value - previousScore
  if (difference > 0) return `较上次提升 ${difference} 分`
  if (difference < 0) return `较上次下降 ${Math.abs(difference)} 分`
  return '与上次持平'
})

const statusText = computed(() => {
  if (qualityScore.value === null) return '未识别到人体，暂无评分'
  if (numericQualityScore.value >= 85) return '动作表现稳定'
  if (numericQualityScore.value >= 70) return '状态良好'
  return '建议继续练习'
})

const scoreDescription = computed(() => {
  if (qualityScore.value === null) return '本次记录会保留在训练历史中，但不计入训练完成、热力图和评分徽章。'
  if (numericQualityScore.value >= 85) return '整体动作控制和完成度很好，可以继续保持。'
  if (numericQualityScore.value >= 70) return '基础动作已经完成得不错，稳定节奏会让表现更完整。'
  return '先放慢节奏，优先保证动作准确性，再逐步提升强度。'
})

const overallTrend = computed(() => {
  if (scoreTrend.value?.trend.length) {
    return scoreTrend.value.trend.slice(-6).map(point => ({ date: point.date, score: point.overallScore }))
  }
  return historySessions.value
    .filter(item => item.modality === session.value?.modality && item.qualityScore !== null)
    .slice(0, 6)
    .reverse()
    .map(item => ({ date: item.date, score: item.qualityScore as number }))
})

function actionTrend(action: ScoredActionResult) {
  const points = historySessions.value
    .filter(item => item.modality === session.value?.modality)
    .flatMap(item => {
      const match = item.scoreDetails?.actionResults?.find(result => (
        result.actionId === action.actionId || result.title === action.title
      ))
      return match ? [{ date: item.date, score: match.score }] : []
    })
    .slice(0, 6)
    .reverse()
  if (!points.some(point => point.date === session.value?.date)) {
    points.push({ date: session.value?.date ?? '', score: action.score })
  }
  return points
}

function actionKey(action: ScoredActionResult) {
  return `${action.itemId}:${action.actionId}`
}

function toggleAction(action: ScoredActionResult) {
  const key = actionKey(action)
  expandedActionKey.value = expandedActionKey.value === key ? '' : key
}

function goHome() { void uni.switchTab({ url: '/pages/training/home' }) }
function goGrowthCenter() { void uni.switchTab({ url: '/pages/growth/index' }) }

onShareAppMessage((options) => {
  const targetDataset = options.target?.dataset as { shareTitle?: string, sharePath?: string } | undefined
  return {
    title: targetDataset?.shareTitle ?? sessionBadge.value?.shareTitle ?? '我完成了一次 Sport Snack 训练',
    path: targetDataset?.sharePath ?? sessionBadge.value?.sharePath ?? '/pages/access/startup'
  }
})
</script>

<template>
  <UniTrainingPageShell :show-dock="false" page-title="训练反馈" show-back show-decorations>
    <view class="feedback-page">
      <view v-if="loadingSession" class="feedback-page__state-card">
        <text class="feedback-page__state-title">正在加载训练结果</text>
        <text class="feedback-page__state-copy">请稍候，正在读取真实训练记录。</text>
      </view>

      <view v-else-if="!session" class="feedback-page__state-card">
        <text class="feedback-page__state-title">{{ sessionLoadError || '暂无可展示的训练结果' }}</text>
        <text class="feedback-page__state-copy">{{ canReloadSession ? '请检查网络后重新加载。' : '你可以返回训练首页开始一次新的训练。' }}</text>
        <button v-if="canReloadSession" class="feedback-page__primary-action feedback-page__retry-action" type="button" hover-class="feedback-page__primary-action--pressed" @click="loadSession">重新加载结果</button>
        <button class="feedback-page__secondary-action" type="button" hover-class="feedback-page__secondary-action--pressed" @click="goHome">返回首页</button>
      </view>

      <template v-else>
        <UniPageHeading inset eyebrow="训练已记录" :title="`${modalityLabel}完成`" :description="`${statusText}，结果已经为你保存。`" />

        <section class="feedback-page__overview-card">
          <view class="feedback-page__overview-head">
            <view class="feedback-page__score-block">
              <text class="feedback-page__section-eyebrow">套组总览</text>
              <text class="feedback-page__score-label">质量得分</text>
              <view class="feedback-page__score-row">
                <text class="feedback-page__score-value">{{ qualityScore === null ? '—' : qualityScore }}</text>
                <text class="feedback-page__score-unit">{{ qualityScore === null ? '暂无评分' : '/ 100' }}</text>
              </view>
            </view>
            <view class="feedback-page__score-copy">
              <text class="feedback-page__change">{{ scoreChangeLabel }}</text>
              <text class="feedback-page__description">{{ scoreDescription }}</text>
            </view>
          </view>

          <TrainingFeedbackBodyMap v-if="overallAngles.length" :angles="overallAngles" />

          <view class="feedback-page__trend-block">
            <view class="feedback-page__section-head">
              <view>
                <text class="feedback-page__section-eyebrow">历史变化</text>
                <text class="feedback-page__section-title">同类训练得分趋势</text>
              </view>
              <text class="feedback-page__section-meta">最近 {{ overallTrend.length }} 次</text>
            </view>
            <TrainingFeedbackTrendChart chart-id="overall-score-trend" :points="overallTrend" />
          </view>
        </section>

        <section class="feedback-page__summary-card">
          <text class="feedback-page__section-eyebrow">本次建议</text>
          <text class="feedback-page__section-title">继续调整动作细节</text>
          <text class="feedback-page__summary">{{ feedbackSummary }}</text>
        </section>

        <section v-if="actionResults.length" class="feedback-page__actions-card">
          <view class="feedback-page__section-head">
            <view>
              <text class="feedback-page__section-eyebrow">动作明细</text>
              <text class="feedback-page__section-title">逐项查看表现</text>
            </view>
            <text class="feedback-page__section-meta">点击展开</text>
          </view>
          <view class="feedback-page__action-list">
            <TrainingFeedbackActionCard
              v-for="(action, index) in actionResults"
              :key="actionKey(action)"
              :action="action"
              :index="index"
              :expanded="expandedActionKey === actionKey(action)"
              :trend="actionTrend(action)"
              @toggle="toggleAction(action)"
            />
          </view>
        </section>

        <section v-if="sessionBadge" class="feedback-page__badge-card">
          <view class="feedback-page__badge-score">
            <text class="feedback-page__badge-score-value">{{ qualityScore ?? '—' }}</text>
            <text class="feedback-page__badge-score-label">本次质量</text>
          </view>
          <view class="feedback-page__badge-copy">
            <text class="feedback-page__section-eyebrow">本次获得徽章</text>
            <text class="feedback-page__section-title">{{ sessionBadge.title }}</text>
            <text class="feedback-page__summary">{{ sessionBadge.description }}</text>
          </view>
          <button class="feedback-page__share-action" type="button" hover-class="feedback-page__share-action--pressed" open-type="share" :data-share-title="sessionBadge.shareTitle" :data-share-path="sessionBadge.sharePath">分享徽章</button>
        </section>

        <view class="feedback-page__footer-actions">
          <button class="feedback-page__primary-action" type="button" hover-class="feedback-page__primary-action--pressed" @click="goHome">返回首页</button>
          <button class="feedback-page__secondary-action" type="button" hover-class="feedback-page__secondary-action--pressed" @click="goGrowthCenter">查看成长中心</button>
        </view>
      </template>
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.feedback-page {
  --feedback-ink: #203042;
  --feedback-muted: #718096;
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 26rpx;
  padding: 16rpx 32rpx 32rpx;
  box-sizing: border-box;
  color: var(--feedback-ink);
}

.feedback-page__state-card,
.feedback-page__overview-card,
.feedback-page__summary-card,
.feedback-page__actions-card,
.feedback-page__badge-card {
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.feedback-page__state-card {
  display: flex;
  min-height: 360rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 40rpx 32rpx;
  text-align: center;
}
.feedback-page__state-title { color: var(--feedback-ink); font-size: 32rpx; font-weight: 900; }
.feedback-page__state-copy { color: var(--feedback-muted); font-size: 23rpx; line-height: 1.55; }

.feedback-page__overview-card,
.feedback-page__summary-card,
.feedback-page__actions-card { display: flex; flex-direction: column; gap: 24rpx; padding: 28rpx; }
.feedback-page__overview-head,
.feedback-page__score-row,
.feedback-page__section-head,
.feedback-page__badge-card,
.feedback-page__footer-actions { display: flex; }
.feedback-page__overview-head { align-items: flex-start; gap: 28rpx; }
.feedback-page__score-block,
.feedback-page__score-copy,
.feedback-page__section-head > view,
.feedback-page__trend-block,
.feedback-page__badge-copy { display: flex; flex-direction: column; }
.feedback-page__score-block { min-width: 154rpx; gap: 8rpx; }
.feedback-page__score-label { color: #718096; font-size: 20rpx; font-weight: 800; }
.feedback-page__score-copy { min-width: 0; flex: 1; gap: 12rpx; }
.feedback-page__score-row { align-items: baseline; gap: 6rpx; }
.feedback-page__score-value { color: var(--feedback-ink); font-size: 62rpx; font-weight: 900; line-height: 0.95; }
.feedback-page__score-unit { color: var(--feedback-muted); font-size: 19rpx; font-weight: 700; }

.feedback-page__change {
  width: fit-content;
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #edf5ef;
  color: #397565;
  font-size: 19rpx;
  font-weight: 900;
}
.feedback-page__description,
.feedback-page__summary { color: var(--feedback-muted); font-size: 22rpx; font-weight: 700; line-height: 1.55; }
.feedback-page__trend-block { gap: 14rpx; padding-top: 4rpx; }
.feedback-page__section-head { align-items: flex-end; justify-content: space-between; gap: 20rpx; }
.feedback-page__section-head > view,
.feedback-page__badge-copy { gap: 6rpx; }
.feedback-page__section-eyebrow { color: #c76b5b; font-size: 19rpx; font-weight: 900; letter-spacing: 0.08em; }
.feedback-page__section-title { color: var(--feedback-ink); font-size: 29rpx; font-weight: 900; line-height: 1.28; }
.feedback-page__section-meta { color: #8a97a8; font-size: 19rpx; font-weight: 700; }
.feedback-page__action-list { display: flex; flex-direction: column; gap: 16rpx; }

.feedback-page__badge-card { align-items: center; gap: 18rpx; padding: 24rpx; }
.feedback-page__badge-score {
  display: flex;
  width: 92rpx;
  height: 92rpx;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #fff1cf;
}
.feedback-page__badge-score-value { color: #8b651d; font-size: 32rpx; font-weight: 900; line-height: 1; }
.feedback-page__badge-score-label { margin-top: 5rpx; color: #9a7430; font-size: 16rpx; font-weight: 800; }
.feedback-page__badge-copy { min-width: 0; flex: 1; }
.feedback-page__share-action {
  min-width: 106rpx;
  min-height: 64rpx;
  flex: none;
  margin: 0;
  padding: 0 16rpx;
  border: 2rpx solid rgba(255, 139, 139, 0.4);
  border-radius: 999rpx;
  background: #fffaf4;
  color: #b75d56;
  font-size: 20rpx;
  font-weight: 900;
}

.feedback-page__footer-actions { flex-direction: column; gap: 16rpx; padding-top: 8rpx; }
.feedback-page__primary-action,
.feedback-page__secondary-action {
  display: flex;
  width: 100%;
  min-height: 92rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 24rpx;
  border-radius: 999rpx;
  box-sizing: border-box;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1.2;
}
.feedback-page__primary-action { border: 2rpx solid var(--feedback-ink); background: var(--feedback-ink); color: #fffaf4; }
.feedback-page__secondary-action { border: 2rpx solid #d7cabd; background: #fffaf4; color: #394756; }
.feedback-page__primary-action--pressed { background: #152432; }
.feedback-page__secondary-action--pressed,
.feedback-page__share-action--pressed { background: #f4ede4; }
.feedback-page__primary-action::after,
.feedback-page__secondary-action::after,
.feedback-page__share-action::after { display: none; }
</style>
