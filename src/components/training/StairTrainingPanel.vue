<script setup lang="ts">
import { computed } from 'vue'
import type { StairTrainingStageId } from '../../features/training/stairTrainingGuide'

const props = defineProps<{
  secondsLeft: number
  isRunning: boolean
  isFinishing: boolean
  stageLabel: string
  stageId: StairTrainingStageId
  currentInstruction: string
  safetyNotice: string
  cadenceSpm: number
  estimatedStepCount: number
  estimatedVerticalSpeedMps: number
  estimatedFloorsPerMin: number
  confidence: number
  sensorStatus: 'ready' | 'collecting' | 'stopped' | 'unavailable'
  sampleCount: number
  questionnaireNavigationState?: 'idle' | 'opening' | 'failed'
}>()

const emit = defineEmits<{
  start: []
  interrupt: []
  continueQuestionnaire: []
}>()

type CurrentMetric = {
  key: 'cadence' | 'steps'
  label: string
  value: string
  unit: string
}

function formatDecimal(value: number, fractionDigits = 1) {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : '0.0'
}

function formatClock(seconds: number) {
  const normalized = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(normalized / 60)
  const remainingSeconds = normalized % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function resolveSensorStatusLabel(status: typeof props.sensorStatus) {
  if (status === 'collecting') return '冲刺采集中'
  if (status === 'stopped') return '冲刺已记录'
  if (status === 'unavailable') return '传感器不可用'
  return props.isRunning ? '等待冲刺采集' : '传感器就绪'
}

function resolveStatusHint() {
  if (props.questionnaireNavigationState === 'failed') {
    return '本次训练已保存，请继续填写训练反馈。'
  }
  if (props.questionnaireNavigationState === 'opening') {
    return '训练已完成，正在打开训练反馈。'
  }
  if (props.isFinishing) return '训练完成，正在整理记录并播放结束提示。'
  if (props.isRunning) return props.currentInstruction
  if (props.sensorStatus === 'unavailable') {
    return '请检查传感器权限后重试，避免记录不完整。'
  }
  return '跟随语音完成热身、30 秒冲刺和拉伸放松。'
}

function resolveRunStateLabel() {
  if (props.questionnaireNavigationState === 'failed') return '等待填写反馈'
  if (props.questionnaireNavigationState === 'opening') return '正在打开反馈'
  if (props.isFinishing) return '正在完成训练'
  if (props.stageId === 'complete' || props.sensorStatus === 'stopped' && !props.isRunning) {
    return '训练完成'
  }
  return props.isRunning ? props.stageLabel : '等待开始'
}

const currentMetrics = computed<CurrentMetric[]>(() => [
  {
    key: 'cadence',
    label: '实时步频',
    value: formatDecimal(props.cadenceSpm),
    unit: '步 / 分钟'
  },
  {
    key: 'steps',
    label: '累计步数',
    value: String(props.estimatedStepCount),
    unit: '步'
  }
])

const formattedTimeLeft = computed(() => formatClock(props.secondsLeft))
const showMetrics = computed(() => props.isRunning || props.sensorStatus === 'stopped')
const sensorStatusClass = computed(() => `stair-panel__sensor-chip--${props.sensorStatus}`)
const isPrimaryActionDisabled = computed(() =>
  props.isRunning || props.isFinishing || props.questionnaireNavigationState === 'opening'
)
const primaryActionLabel = computed(() => {
  if (props.questionnaireNavigationState === 'failed') {
    return '继续填写反馈'
  }

  if (props.questionnaireNavigationState === 'opening') {
    return '正在打开反馈'
  }
  if (props.isFinishing) return '正在完成'

  return props.isRunning ? '训练进行中' : '开始 5 分钟训练'
})

function handlePrimaryAction() {
  if (props.questionnaireNavigationState === 'failed') {
    emit('continueQuestionnaire')
    return
  }

  emit('start')
}
</script>

<template>
  <view class="stair-panel">
    <view class="stair-panel__hero">
      <view class="stair-panel__hero-head">
        <view class="stair-panel__hero-copy">
          <text class="stair-panel__hero-title">冲刺爬楼</text>
          <text class="stair-panel__stage-label">{{ resolveRunStateLabel() }}</text>
          <text class="stair-panel__hero-support">{{ resolveStatusHint() }}</text>
        </view>

        <view class="stair-panel__sensor-chip" :class="sensorStatusClass">
          <view class="stair-panel__sensor-dot" />
          <text>{{ resolveSensorStatusLabel(sensorStatus) }}</text>
        </view>
      </view>

      <view class="stair-panel__countdown-card">
        <view class="stair-panel__countdown-copy">
          <text class="stair-panel__countdown-label">全程剩余</text>
          <view class="stair-panel__countdown-value-row">
            <text class="stair-panel__countdown-value">{{ formattedTimeLeft }}</text>
          </view>
          <text class="stair-panel__countdown-state">语音将自动提示下一步</text>
        </view>
        <text class="stair-panel__countdown-goal">{{ stageLabel }}</text>
      </view>

      <view v-if="showMetrics" class="stair-panel__metric-strip" aria-label="冲刺实时数据">
        <view
          v-for="metric in currentMetrics"
          :key="metric.key"
          class="stair-panel__metric-card"
        >
          <text class="stair-panel__metric-label">{{ metric.label }}</text>
          <view class="stair-panel__metric-value-row">
            <text class="stair-panel__metric-value">{{ metric.value }}</text>
            <text class="stair-panel__metric-unit">{{ metric.unit }}</text>
          </view>
        </view>
      </view>

      <view v-if="!isRunning && sensorStatus === 'ready'" class="stair-panel__safety-note">
        <text class="stair-panel__safety-title">开始前请确认安全</text>
        <text class="stair-panel__safety-copy">{{ safetyNotice }}</text>
      </view>

      <view class="stair-panel__actions">
        <button
          class="stair-panel__primary-action"
          :class="{ 'stair-panel__primary-action--disabled': isPrimaryActionDisabled }"
          type="button"
          form-type="button"
          hover-class="stair-panel__primary-action--pressed"
          :disabled="isPrimaryActionDisabled"
          @click="handlePrimaryAction"
        >
          <text>{{ primaryActionLabel }}</text>
        </button>

        <button
          class="stair-panel__secondary-action"
          type="button"
          form-type="button"
          hover-class="stair-panel__secondary-action--pressed"
          @click="emit('interrupt')"
        >
          <text>退出训练</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.stair-panel {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.stair-panel__hero {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 40rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
}

.stair-panel__hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 24rpx;
  margin-left: 32rpx;
}

.stair-panel__hero-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
}

.stair-panel__stage-label {
  color: #966451;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.25;
}

.stair-panel__hero-title {
  color: #263442;
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.08;
}

.stair-panel__hero-support {
  max-width: 480rpx;
  color: #627080;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.52;
}

.stair-panel__sensor-chip {
  display: inline-flex;
  min-height: 56rpx;
  flex: none;
  align-items: center;
  gap: 10rpx;
  padding: 0 18rpx;
  border: 2rpx solid #d9e2dd;
  border-radius: 9999px;
  background: #f1f6f2;
  color: #365f51;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.stair-panel__sensor-chip--unavailable {
  border-color: #e9d5bd;
  background: #fbf2e5;
  color: #865d27;
}

.stair-panel__sensor-chip--stopped {
  border-color: #d8e1dd;
  background: #eff4f1;
  color: #385e50;
}

.stair-panel__sensor-dot {
  width: 12rpx;
  height: 12rpx;
  flex: none;
  border-radius: 9999px;
  background: currentColor;
}

.stair-panel__countdown-card {
  display: flex;
  min-height: 210rpx;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 32rpx;
  padding: 30rpx;
  border-radius: 28rpx;
  background: #263442;
  box-sizing: border-box;
}

.stair-panel__countdown-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
}

.stair-panel__countdown-label {
  color: #dbe3e5;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.2;
}

.stair-panel__countdown-value-row {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.stair-panel__countdown-value {
  color: #fff7e9;
  font-size: 80rpx;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 0.86;
}

.stair-panel__countdown-unit {
  color: #dbe3e5;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.stair-panel__countdown-state {
  color: #b9c9c4;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.2;
}

.stair-panel__countdown-goal {
  max-width: 190rpx;
  padding-bottom: 4rpx;
  color: #dbe3e5;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.45;
  text-align: right;
}

.stair-panel__metric-strip {
  display: flex;
  margin-top: 24rpx;
  border-top: 2rpx solid #e0d6ca;
  border-bottom: 2rpx solid #e0d6ca;
}

.stair-panel__metric-card {
  display: flex;
  min-width: 0;
  min-height: 130rpx;
  flex: 1 1 0;
  flex-direction: column;
  justify-content: center;
  gap: 12rpx;
  padding: 20rpx 18rpx;
  box-sizing: border-box;
}

.stair-panel__metric-card + .stair-panel__metric-card {
  border-left: 2rpx solid #e0d6ca;
}

.stair-panel__metric-label {
  color: #627080;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.25;
}

.stair-panel__metric-value-row {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8rpx;
}

.stair-panel__metric-value {
  color: #263442;
  font-size: 46rpx;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 0.95;
}

.stair-panel__metric-unit {
  min-width: 0;
  color: #627080;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.25;
}

.stair-panel__safety-note {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border: 2rpx solid #e2d2bf;
  border-radius: 24rpx;
  background: #fbf3e8;
}

.stair-panel__safety-title {
  color: #714c2a;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.3;
}

.stair-panel__safety-copy {
  color: #654f3d;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.55;
}

.stair-panel__actions {
  display: flex;
  gap: 16rpx;
  margin-top: auto;
  padding-top: 28rpx;
}

.stair-panel__primary-action,
.stair-panel__secondary-action {
  display: inline-flex;
  min-height: 104rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  box-sizing: border-box;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.2;
}

.stair-panel__primary-action::after,
.stair-panel__secondary-action::after {
  display: none;
}

.stair-panel__primary-action {
  flex: 1.2 1 0;
  border: 2rpx solid #263442;
  background: #263442;
  color: #fffaf4;
}

.stair-panel__primary-action--disabled {
  border-color: #87929c;
  background: #87929c;
  color: #f7f2ea;
}

.stair-panel__primary-action--pressed {
  background: #1e2a36;
}

.stair-panel__secondary-action {
  flex: 0.8 1 0;
  border: 2rpx solid #d8cdc0;
  background: #f4ede4;
  color: #394756;
}

.stair-panel__secondary-action--pressed {
  background: #eae0d4;
}

@media (max-height: 640px) {
  .stair-panel__hero {
    padding-top: 28rpx;
  }

  .stair-panel__hero-head {
    gap: 18rpx;
  }

  .stair-panel__countdown-card {
    min-height: 184rpx;
    margin-top: 20rpx;
    padding: 24rpx;
  }

  .stair-panel__countdown-value {
    font-size: 70rpx;
  }

  .stair-panel__metric-strip {
    margin-top: 18rpx;
  }

  .stair-panel__metric-card {
    min-height: 112rpx;
    padding-top: 16rpx;
    padding-bottom: 16rpx;
  }

  .stair-panel__actions {
    padding-top: 20rpx;
  }

  .stair-panel__primary-action,
  .stair-panel__secondary-action {
    min-height: 88rpx;
  }
}
</style>
