<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, ref, shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import type { TrainingModality } from '../../../domain/student/types'
import type { ExerciseArrangementSummary } from '../../api/studentBackendTypes'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import UniTrainingPageShell from '../../components/training/UniTrainingPageShell.vue'
import { ensureProtectedStudentAccess } from '../../composables/useNavigationGuard'

type VisualModality = Exclude<TrainingModality, 'stair'>

const modality = shallowRef<VisualModality>('wushu')
const arrangements = shallowRef<ExerciseArrangementSummary[]>([])
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
let loadRequestId = 0

const modalityLabel = computed(() => modality.value === 'hiit' ? '自重抗阻' : '武术')
const pageTitle = computed(() => `选择${modalityLabel.value}套组`)
const accentTone = computed(() => modality.value === 'hiit' ? 'teal' : 'coral')

function normalizeModality(value: unknown): VisualModality {
  return value?.toString() === 'hiit' ? 'hiit' : 'wushu'
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0))
  if (safeSeconds < 60) return `约 ${safeSeconds} 秒`
  const minutes = Math.ceil(safeSeconds / 60)
  return `约 ${minutes} 分钟`
}

async function loadArrangements(options: { refresh?: boolean } = {}) {
  const requestId = ++loadRequestId
  const isRefresh = options.refresh === true
  if (isRefresh) refreshing.value = true
  else loading.value = true
  errorMessage.value = ''

  try {
    const nextArrangements = await studentBackendSync.listVisualExerciseArrangements(
      modality.value
    )
    if (requestId === loadRequestId) arrangements.value = nextArrangements
  } catch (error) {
    if (requestId === loadRequestId) {
      errorMessage.value = '训练套组加载失败，请检查网络后重试。'
      reportBackendSyncError('训练套组加载', error)
    }
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false
      refreshing.value = false
    }
  }
}

async function selectArrangement(arrangement: ExerciseArrangementSummary) {
  const canExecute = await ensureProtectedStudentAccess('execute')
  if (!canExecute) return

  void uni.navigateTo({
    url: `/subpackages/training/visual-session?modality=${modality.value}&arrangementId=${arrangement.id}`
  })
}

onLoad((query) => {
  modality.value = normalizeModality(query?.modality)
  void loadArrangements()
})
</script>

<template>
  <UniTrainingPageShell
    :page-title="pageTitle"
    :show-dock="false"
    show-decorations
    show-back
    access-mode="execute"
    refresh-enabled
    :refreshing="refreshing"
    @refresh="loadArrangements({ refresh: true })"
  >
    <view class="exercise-sets-page">
      <view class="exercise-sets-page__intro">
        <text class="exercise-sets-page__eyebrow">{{ modalityLabel }} 跟练</text>
        <text class="exercise-sets-page__title">选择今天要练的套组</text>
        <text class="exercise-sets-page__support">
          每套训练包含一组按顺序编排的配套动作，选择后将从动作讲解开始。
        </text>
      </view>

      <view v-if="loading" class="exercise-sets-page__state" aria-live="polite">
        <view class="exercise-sets-page__state-icon exercise-sets-page__state-icon--loading">
          <uni-icons type="spinner-cycle" size="24" color="#718096" />
        </view>
        <text>正在加载训练套组…</text>
      </view>

      <view v-else-if="errorMessage" class="exercise-sets-page__state" aria-live="assertive">
        <view class="exercise-sets-page__state-icon">
          <uni-icons type="info" size="22" color="#c76b5b" />
        </view>
        <text>{{ errorMessage }}</text>
        <button class="exercise-sets-page__retry" type="button" @click="loadArrangements()">
          重新加载
        </button>
      </view>

      <view v-else-if="arrangements.length === 0" class="exercise-sets-page__state">
        <view class="exercise-sets-page__state-icon">
          <uni-icons type="calendar" size="22" color="#718096" />
        </view>
        <text>当前暂无可用的{{ modalityLabel }}训练套组。</text>
      </view>

      <view v-else class="exercise-sets-page__list" aria-label="选择训练套组">
        <button
          v-for="(arrangement, index) in arrangements"
          :key="arrangement.id"
          :class="[
            'exercise-sets-page__card',
            `exercise-sets-page__card--${accentTone}`
          ]"
          type="button"
          form-type="button"
          hover-class="exercise-sets-page__card--pressed"
          :aria-label="`第${index + 1}套，${arrangement.title}`"
          @click="selectArrangement(arrangement)"
        >
          <view :class="['exercise-sets-page__number', `exercise-sets-page__number--${accentTone}`]">
            <text>第</text>
            <text class="exercise-sets-page__number-value">{{ index + 1 }}</text>
            <text>套</text>
          </view>
          <view class="exercise-sets-page__copy">
            <text class="exercise-sets-page__card-title">{{ arrangement.title }}</text>
            <text v-if="arrangement.description" class="exercise-sets-page__description">
              {{ arrangement.description }}
            </text>
            <view class="exercise-sets-page__meta">
              <text>{{ arrangement.item_count }} 个动作</text>
              <view class="exercise-sets-page__meta-dot" />
              <text>{{ formatDuration(arrangement.total_duration) }}</text>
            </view>
          </view>
          <view class="exercise-sets-page__enter" aria-hidden="true">
            <text>选择</text>
            <uni-icons type="right" size="16" color="#c76b5b" />
          </view>
        </button>
      </view>
    </view>
  </UniTrainingPageShell>
</template>

<style scoped>
.exercise-sets-page {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 30rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.exercise-sets-page__intro {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 24rpx 32rpx 0 64rpx;
}

.exercise-sets-page__eyebrow {
  color: #c76b5b;
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.exercise-sets-page__title {
  color: #203042;
  font-size: 38rpx;
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.exercise-sets-page__support {
  max-width: 650rpx;
  color: #718096;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1.55;
}

.exercise-sets-page__list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 0 32rpx;
}

.exercise-sets-page__card {
  display: flex;
  width: 100%;
  min-height: 176rpx;
  align-items: center;
  gap: 22rpx;
  margin: 0;
  padding: 26rpx 24rpx;
  border: 2rpx solid rgba(255, 139, 139, 0.18);
  border-radius: 30rpx;
  background: rgba(255, 250, 244, 0.94);
  box-sizing: border-box;
  color: #203042;
  text-align: left;
  box-shadow: 0 8rpx 22rpx rgba(69, 52, 35, 0.04);
}

.exercise-sets-page__card::after,
.exercise-sets-page__retry::after {
  border: 0;
}

.exercise-sets-page__card--teal {
  border-color: rgba(120, 184, 220, 0.2);
  background: rgba(246, 251, 253, 0.94);
}

.exercise-sets-page__card--pressed {
  opacity: 0.76;
  transform: scale(0.985);
}

.exercise-sets-page__number {
  display: flex;
  width: 78rpx;
  height: 78rpx;
  flex: none;
  align-items: baseline;
  justify-content: center;
  border-radius: 24rpx;
  background: #ffe8e5;
  color: #a85a50;
  font-size: 19rpx;
  font-weight: 800;
  line-height: 78rpx;
}

.exercise-sets-page__number--teal {
  background: #e0f1f8;
  color: #2b7cb8;
}

.exercise-sets-page__number-value {
  margin: 0 2rpx;
  font-size: 34rpx;
  font-weight: 900;
}

.exercise-sets-page__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.exercise-sets-page__card-title {
  color: #203042;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 1.3;
}

.exercise-sets-page__description {
  display: -webkit-box;
  overflow: hidden;
  color: #718096;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.exercise-sets-page__meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #8a97a8;
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.25;
}

.exercise-sets-page__meta-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 9999px;
  background: #ffb8b8;
}

.exercise-sets-page__enter {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2rpx;
  color: #c76b5b;
  font-size: 23rpx;
  font-weight: 800;
  white-space: nowrap;
}

.exercise-sets-page__state {
  display: flex;
  min-height: 300rpx;
  margin: 0 32rpx;
  padding: 40rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 18rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.22);
  border-radius: 30rpx;
  background: rgba(255, 250, 244, 0.92);
  box-sizing: border-box;
  color: #718096;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
}

.exercise-sets-page__state-icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #f3ede5;
}

.exercise-sets-page__state-icon--loading {
  animation: exercise-sets-spin 900ms linear infinite;
}

.exercise-sets-page__retry {
  display: inline-flex;
  min-height: 64rpx;
  margin: 4rpx 0 0;
  padding: 0 24rpx;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: #ff7777;
  color: #fffaf4;
  font-size: 23rpx;
  font-weight: 800;
}

@keyframes exercise-sets-spin {
  to { transform: rotate(360deg); }
}
</style>
