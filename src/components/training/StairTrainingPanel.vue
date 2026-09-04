<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  secondsLeft: number
  isRunning: boolean
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

function resolveSensorStatusLabel(status: typeof props.sensorStatus) {
  if (status === 'collecting') {
    return '传感器采集中'
  }

  if (status === 'stopped') {
    return '本轮已完成'
  }

  if (status === 'unavailable') {
    return '传感器不可用'
  }

  return '传感器就绪'
}

function resolveStatusHint() {
  if (props.questionnaireNavigationState === 'failed') {
    return '本轮训练已保存，请继续填写训练反馈。'
  }

  if (props.questionnaireNavigationState === 'opening') {
    return '训练已完成，正在打开训练反馈。'
  }

  if (props.sensorStatus === 'collecting') {
    return '保持连续上楼，系统正在记录你的节奏和步数。'
  }

  if (props.sensorStatus === 'stopped') {
    return '本轮采集结束，正在整理这次训练记录。'
  }

  if (props.sensorStatus === 'unavailable') {
    return '请检查传感器权限后重试，避免记录不完整。'
  }

  return '准备好后开始 30 秒连续上楼。'
}

function resolveRunStateLabel() {
  if (props.questionnaireNavigationState === 'failed') {
    return '等待填写反馈'
  }

  if (props.questionnaireNavigationState === 'opening') {
    return '正在打开反馈'
  }

  if (props.sensorStatus === 'stopped') {
    return '训练完成'
  }

  return props.isRunning ? '训练进行中' : '等待开始'
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

const sensorStatusClass = computed(() => `stair-panel__sensor-chip--${props.sensorStatus}`)
const isPrimaryActionDisabled = computed(() =>
  props.isRunning || props.questionnaireNavigationState === 'opening'
)
const primaryActionLabel = computed(() => {
  if (props.questionnaireNavigationState === 'failed') {
    return '继续填写反馈'
  }

  if (props.questionnaireNavigationState === 'opening') {
    return '正在打开反馈'
  }

  return props.isRunning ? '训练进行中' : '开始 30 秒训练'
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
          <text class="stair-panel__eyebrow">{{ resolveRunStateLabel() }}</text>
          <text class="stair-panel__hero-title">阶梯训练</text>
          <text class="stair-panel__hero-support">{{ resolveStatusHint() }}</text>
        </view>

        <view class="stair-panel__sensor-chip" :class="sensorStatusClass">
          <view class="stair-panel__sensor-dot" />
          <text>{{ resolveSensorStatusLabel(sensorStatus) }}</text>
        </view>
      </view>

      <view class="stair-panel__countdown-card">
        <view class="stair-panel__countdown-copy">
          <text class="stair-panel__countdown-label">本轮剩余</text>
          <view class="stair-panel__countdown-value-row">
            <text class="stair-panel__countdown-value">{{ secondsLeft }}</text>
            <text class="stair-panel__countdown-unit">秒</text>
          </view>
          <text class="stair-panel__countdown-state">{{ resolveRunStateLabel() }}</text>
        </view>
        <text class="stair-panel__countdown-goal">连续上楼 30 秒</text>
      </view>

      <view class="stair-panel__metric-strip" aria-label="本轮实时数据">
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
  overflow: hidden;
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

.stair-panel__eyebrow {
  color: #966451;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 0.06em;
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
  letter-spacing: -0.06em;
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
  letter-spacing: -0.045em;
  line-height: 0.95;
}

.stair-panel__metric-unit {
  min-width: 0;
  color: #627080;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.25;
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
