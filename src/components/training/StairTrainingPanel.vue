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
}>()

const emit = defineEmits<{
  start: []
  interrupt: []
}>()

type MetricTone = 'sky' | 'violet' | 'mint' | 'amber'
type MetricGlyph = 'pulse' | 'footprints' | 'trend' | 'stairs'

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
    return '传感器受限'
  }

  return '传感器就绪'
}

function resolveStatusHint() {
  if (props.sensorStatus === 'collecting') {
    return '保持连续上楼，读数会按样本实时刷新。'
  }

  if (props.sensorStatus === 'stopped') {
    return '本轮采集结束，数据已锁定并准备同步。'
  }

  if (props.sensorStatus === 'unavailable') {
    return '当前环境无法稳定采集传感器，将退回基础计时模式。'
  }

  return '等待开始，准备连续上楼 30 秒。'
}

function resolveRunStateLabel() {
  if (props.sensorStatus === 'stopped') {
    return '训练完成'
  }

  return props.isRunning ? '训练进行中' : '等待开始'
}

const metricCards = computed<
  Array<{
    key: string
    label: string
    value: string
    unit: string
    tone: MetricTone
    glyph: MetricGlyph
  }>
>(() => [
  {
    key: 'cadence',
    label: '实时步频',
    value: formatDecimal(props.cadenceSpm),
    unit: '步 / 分钟',
    tone: 'sky',
    glyph: 'pulse'
  },
  {
    key: 'steps',
    label: '累计步数',
    value: String(props.estimatedStepCount),
    unit: '步',
    tone: 'violet',
    glyph: 'footprints'
  },
  {
    key: 'vertical-speed',
    label: '爬升速度',
    value: formatDecimal(props.estimatedVerticalSpeedMps, 2),
    unit: '米 / 秒',
    tone: 'mint',
    glyph: 'trend'
  },
  {
    key: 'floors',
    label: '楼层速度',
    value: formatDecimal(props.estimatedFloorsPerMin, 1),
    unit: '层 / 分钟',
    tone: 'amber',
    glyph: 'stairs'
  }
])
</script>

<template>
  <view class="stair-panel">
    <view class="stair-panel__hero">
      <view class="stair-panel__hero-head">
        <view class="stair-panel__hero-mark">
          <view class="stair-panel__hero-stars">
            <view class="stair-panel__hero-star stair-panel__hero-star--small" />
            <view class="stair-panel__hero-star stair-panel__hero-star--large" />
          </view>
          <view class="stair-panel__hero-steps">
            <view class="stair-panel__hero-step stair-panel__hero-step--1" />
            <view class="stair-panel__hero-step stair-panel__hero-step--2" />
            <view class="stair-panel__hero-step stair-panel__hero-step--3" />
          </view>
          <view class="stair-panel__hero-flag" />
        </view>

        <view class="stair-panel__hero-copy">
          <text class="stair-panel__hero-title">阶梯冲刺</text>
          <text class="stair-panel__hero-support">{{ resolveStatusHint() }}</text>
        </view>

        <view class="stair-panel__sensor-chip">
          <view class="stair-panel__sensor-dot" />
          <text>{{ resolveSensorStatusLabel(sensorStatus) }}</text>
        </view>
      </view>

      <view class="stair-panel__countdown-card">
        <view class="stair-panel__countdown-copy">
          <text class="stair-panel__countdown-label">剩余秒数</text>
          <text class="stair-panel__countdown-value">{{ secondsLeft }}</text>
          <text class="stair-panel__countdown-state">{{ resolveRunStateLabel() }}</text>
        </view>

        <view class="stair-panel__countdown-art">
          <view class="stair-panel__clock-ring" />
          <view class="stair-panel__clock-hand stair-panel__clock-hand--minute" />
          <view class="stair-panel__clock-hand stair-panel__clock-hand--hour" />
          <view class="stair-panel__clock-crown" />
          <view class="stair-panel__countdown-spark stair-panel__countdown-spark--1" />
          <view class="stair-panel__countdown-spark stair-panel__countdown-spark--2" />
        </view>
      </view>

      <view class="stair-panel__metrics">
        <view
          v-for="metric in metricCards"
          :key="metric.key"
          class="stair-panel__metric-card"
        >
          <view class="stair-panel__metric-icon" :class="`stair-panel__metric-icon--${metric.tone}`">
            <view
              class="stair-panel__metric-glyph"
              :class="`stair-panel__metric-glyph--${metric.glyph}`"
            >
              <template v-if="metric.glyph === 'pulse'">
                <view class="stair-panel__metric-line stair-panel__metric-line--pulse" />
              </template>

              <template v-else-if="metric.glyph === 'footprints'">
                <view class="stair-panel__metric-blob stair-panel__metric-blob--left" />
                <view class="stair-panel__metric-blob stair-panel__metric-blob--right" />
              </template>

              <template v-else-if="metric.glyph === 'trend'">
                <view class="stair-panel__metric-line stair-panel__metric-line--trend" />
              </template>

              <template v-else-if="metric.glyph === 'stairs'">
                <view class="stair-panel__metric-stairs">
                  <view class="stair-panel__metric-stair stair-panel__metric-stair--1" />
                  <view class="stair-panel__metric-stair stair-panel__metric-stair--2" />
                  <view class="stair-panel__metric-stair stair-panel__metric-stair--3" />
                </view>
              </template>

              <template v-else-if="metric.glyph === 'shield'">
                <view class="stair-panel__metric-shield" />
              </template>

              <template v-else>
                <view class="stair-panel__metric-bars">
                  <view class="stair-panel__metric-bar stair-panel__metric-bar--1" />
                  <view class="stair-panel__metric-bar stair-panel__metric-bar--2" />
                  <view class="stair-panel__metric-bar stair-panel__metric-bar--3" />
                </view>
              </template>
            </view>
          </view>

          <view class="stair-panel__metric-copy">
            <text class="stair-panel__metric-label">{{ metric.label }}</text>
            <text class="stair-panel__metric-value">{{ metric.value }}</text>
            <text class="stair-panel__metric-unit">{{ metric.unit }}</text>
          </view>
        </view>
      </view>

      <view class="stair-panel__actions">
        <button
          class="stair-panel__primary-action"
          type="button"
          form-type="button"
          hover-class="stair-panel__primary-action--pressed"
          :disabled="isRunning"
          @click="emit('start')"
        >
          <view class="stair-panel__action-disc">
            <view class="stair-panel__play-triangle" />
          </view>
          <text>{{ isRunning ? '训练进行中' : '开始训练' }}</text>
        </button>

        <button
          class="stair-panel__secondary-action"
          type="button"
          form-type="button"
          hover-class="stair-panel__secondary-action--pressed"
          @click="emit('interrupt')"
        >
          <view class="stair-panel__exit-icon">
            <view class="stair-panel__exit-door" />
            <view class="stair-panel__exit-arrow" />
          </view>
          <text>退出</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.stair-panel {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.stair-panel__hero {
  position: relative;
  display: flex;
  height: 100%;
  width: 100%;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 56rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 211, 132, 0.42), transparent 30%),
    radial-gradient(circle at left center, rgba(172, 223, 255, 0.36), transparent 25%),
    linear-gradient(180deg, rgba(255, 252, 247, 0.98), rgba(255, 247, 238, 0.98));
  padding: 44rpx 28rpx 32rpx;
  box-shadow:
    0 32rpx 72rpx rgba(210, 189, 163, 0.26),
    inset 0 0 0 2rpx rgba(255, 255, 255, 0.85);
}

.stair-panel__hero::before,
.stair-panel__hero::after {
  position: absolute;
  border-radius: 9999px;
  content: '';
  pointer-events: none;
}

.stair-panel__hero::before {
  top: 120rpx;
  right: -88rpx;
  width: 240rpx;
  height: 240rpx;
  background: rgba(255, 214, 188, 0.45);
}

.stair-panel__hero::after {
  left: -86rpx;
  bottom: 180rpx;
  width: 190rpx;
  height: 190rpx;
  background: rgba(204, 234, 255, 0.35);
}

.stair-panel__hero-head {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 22rpx 18rpx;
  align-items: start;
}

.stair-panel__hero-mark {
  position: relative;
  width: 126rpx;
  height: 126rpx;
}

.stair-panel__hero-stars {
  position: absolute;
  top: 2rpx;
  left: 4rpx;
  width: 34rpx;
  height: 34rpx;
}

.stair-panel__hero-star {
  position: absolute;
  background: rgba(255, 214, 108, 0.92);
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
}

.stair-panel__hero-star--small {
  width: 12rpx;
  height: 12rpx;
  top: 10rpx;
  left: 0;
}

.stair-panel__hero-star--large {
  width: 18rpx;
  height: 18rpx;
  top: 0;
  right: 4rpx;
}

.stair-panel__hero-steps {
  position: absolute;
  left: 22rpx;
  bottom: 16rpx;
  display: flex;
  align-items: flex-end;
}

.stair-panel__hero-step {
  border-radius: 10rpx;
  background: linear-gradient(180deg, #ffe9aa, #ffc36a);
  box-shadow: 0 10rpx 18rpx rgba(255, 196, 94, 0.24);
}

.stair-panel__hero-step--1 {
  width: 38rpx;
  height: 26rpx;
}

.stair-panel__hero-step--2 {
  width: 38rpx;
  height: 46rpx;
  margin-left: -4rpx;
}

.stair-panel__hero-step--3 {
  width: 38rpx;
  height: 68rpx;
  margin-left: -4rpx;
}

.stair-panel__hero-flag {
  position: absolute;
  right: 14rpx;
  top: 28rpx;
  width: 18rpx;
  height: 66rpx;
  background: linear-gradient(180deg, rgba(255, 213, 174, 0.96), rgba(255, 188, 142, 0.96));
  border-radius: 9999px;
}

.stair-panel__hero-flag::after {
  position: absolute;
  top: 0;
  left: 12rpx;
  width: 26rpx;
  height: 18rpx;
  border-radius: 4rpx 10rpx 10rpx 4rpx;
  background: linear-gradient(135deg, #ffb37b, #ff936d);
  content: '';
}

.stair-panel__hero-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14rpx;
}

.stair-panel__hero-title {
  color: #1f2f47;
  font-size: 76rpx;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.05em;
}

.stair-panel__hero-support {
  max-width: 520rpx;
  color: #64748b;
  font-size: 26rpx;
  line-height: 1.58;
  font-weight: 700;
}

.stair-panel__sensor-chip {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  justify-self: end;
  padding: 16rpx 24rpx;
  border-radius: 9999px;
  background: rgba(233, 247, 236, 0.96);
  color: #42624f;
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 900;
}

.stair-panel__sensor-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 9999px;
  background: #4cc38a;
  box-shadow: inset 0 0 0 6rpx rgba(255, 255, 255, 0.82);
}

.stair-panel__countdown-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 34rpx;
  overflow: hidden;
  border-radius: 38rpx;
  background:
    radial-gradient(circle at 85% 80%, rgba(255, 255, 255, 0.08), transparent 26%),
    radial-gradient(circle at 72% 42%, rgba(255, 255, 255, 0.06), transparent 14%),
    linear-gradient(135deg, #22304a, #161f34);
  padding: 34rpx 30rpx;
  box-shadow: 0 24rpx 42rpx rgba(31, 47, 71, 0.16);
}

.stair-panel__countdown-copy {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.stair-panel__countdown-label {
  color: rgba(255, 255, 255, 0.92);
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 900;
}

.stair-panel__countdown-value {
  color: #ff938f;
  font-size: 128rpx;
  line-height: 0.9;
  font-weight: 900;
  letter-spacing: -0.06em;
}

.stair-panel__countdown-state {
  color: rgba(255, 255, 255, 0.64);
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 800;
}

.stair-panel__countdown-art {
  position: relative;
  width: 190rpx;
  min-width: 190rpx;
}

.stair-panel__clock-ring {
  position: absolute;
  top: 18rpx;
  right: 16rpx;
  width: 92rpx;
  height: 92rpx;
  border: 8rpx solid rgba(255, 255, 255, 0.26);
  border-radius: 9999px;
}

.stair-panel__clock-hand {
  position: absolute;
  top: 57rpx;
  right: 58rpx;
  width: 6rpx;
  transform-origin: center top;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.38);
}

.stair-panel__clock-hand--minute {
  height: 26rpx;
  transform: rotate(0deg);
}

.stair-panel__clock-hand--hour {
  height: 18rpx;
  transform: rotate(-48deg);
}

.stair-panel__clock-crown {
  position: absolute;
  top: 12rpx;
  right: 14rpx;
  width: 20rpx;
  height: 10rpx;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.26);
  transform: rotate(42deg);
}

.stair-panel__countdown-spark {
  position: absolute;
  background: #ffd36c;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
}

.stair-panel__countdown-spark--1 {
  right: 50rpx;
  bottom: 20rpx;
  width: 22rpx;
  height: 22rpx;
}

.stair-panel__countdown-spark--2 {
  right: 16rpx;
  bottom: 48rpx;
  width: 12rpx;
  height: 12rpx;
}

.stair-panel__metrics {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin-top: 28rpx;
  overflow: hidden;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(4rpx);
}

.stair-panel__metric-card {
  position: relative;
  display: flex;
  gap: 16rpx;
  min-height: 176rpx;
  padding: 28rpx 24rpx;
  background: rgba(255, 255, 255, 0.34);
}

.stair-panel__metric-card:nth-child(odd)::after {
  position: absolute;
  top: 24rpx;
  right: 0;
  width: 2rpx;
  height: calc(100% - 48rpx);
  background: rgba(217, 224, 232, 0.9);
  content: '';
}

.stair-panel__metric-card:nth-child(-n + 4)::before {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 0;
  height: 2rpx;
  background: rgba(217, 224, 232, 0.9);
  content: '';
}

.stair-panel__metric-icon {
  position: relative;
  display: inline-flex;
  width: 86rpx;
  height: 86rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
}

.stair-panel__metric-icon--sky {
  background: rgba(212, 232, 255, 0.94);
  color: #5a98d8;
}

.stair-panel__metric-icon--violet {
  background: rgba(238, 226, 255, 0.92);
  color: #9777da;
}

.stair-panel__metric-icon--mint {
  background: rgba(221, 243, 224, 0.96);
  color: #57c18b;
}

.stair-panel__metric-icon--amber {
  background: rgba(255, 239, 207, 0.96);
  color: #f1ad62;
}

.stair-panel__metric-icon--gold {
  background: rgba(255, 241, 200, 0.96);
  color: #e2ac2c;
}

.stair-panel__metric-icon--ice {
  background: rgba(221, 238, 255, 0.96);
  color: #7ab2ea;
}

.stair-panel__metric-glyph {
  position: relative;
  width: 42rpx;
  height: 42rpx;
}

.stair-panel__metric-line {
  position: absolute;
}

.stair-panel__metric-line--pulse {
  inset: 10rpx 0 10rpx 0;
  background: currentColor;
  clip-path: polygon(0 56%, 18% 56%, 32% 32%, 48% 74%, 64% 18%, 82% 56%, 100% 56%, 100% 68%, 76% 68%, 64% 34%, 48% 88%, 30% 44%, 18% 68%, 0 68%);
}

.stair-panel__metric-blob {
  position: absolute;
  top: 4rpx;
  width: 16rpx;
  height: 24rpx;
  border-radius: 9999px 9999px 12rpx 12rpx;
  background: currentColor;
}

.stair-panel__metric-blob--left {
  left: 6rpx;
  transform: rotate(20deg);
}

.stair-panel__metric-blob--right {
  right: 6rpx;
  transform: rotate(-20deg);
}

.stair-panel__metric-blob--left::after,
.stair-panel__metric-blob--right::after {
  position: absolute;
  bottom: -8rpx;
  width: 8rpx;
  height: 10rpx;
  border-radius: 9999px;
  background: currentColor;
  content: '';
}

.stair-panel__metric-blob--left::after {
  left: 4rpx;
}

.stair-panel__metric-blob--right::after {
  right: 4rpx;
}

.stair-panel__metric-line--trend {
  left: 2rpx;
  right: 2rpx;
  bottom: 8rpx;
  height: 26rpx;
  background: currentColor;
  clip-path: polygon(0 90%, 0 72%, 32% 40%, 54% 62%, 82% 18%, 82% 0, 100% 0, 100% 18%, 88% 18%, 88% 36%, 54% 80%, 30% 58%, 8% 90%);
}

.stair-panel__metric-stairs {
  position: absolute;
  left: 3rpx;
  right: 3rpx;
  bottom: 4rpx;
  height: 32rpx;
}

.stair-panel__metric-stair {
  position: absolute;
  bottom: 0;
  border-radius: 8rpx 8rpx 4rpx 4rpx;
  background: currentColor;
}

.stair-panel__metric-stair--1 {
  left: 0;
  width: 14rpx;
  height: 12rpx;
}

.stair-panel__metric-stair--2 {
  left: 12rpx;
  width: 14rpx;
  height: 22rpx;
}

.stair-panel__metric-stair--3 {
  left: 24rpx;
  width: 14rpx;
  height: 32rpx;
}

.stair-panel__metric-shield {
  position: absolute;
  inset: 2rpx 7rpx 6rpx;
  border: 4rpx solid currentColor;
  border-radius: 14rpx 14rpx 18rpx 18rpx;
  clip-path: polygon(50% 0, 100% 16%, 100% 54%, 50% 100%, 0 54%, 0 16%);
}

.stair-panel__metric-shield::after {
  position: absolute;
  left: 10rpx;
  top: 10rpx;
  width: 8rpx;
  height: 14rpx;
  border-right: 4rpx solid currentColor;
  border-bottom: 4rpx solid currentColor;
  transform: rotate(38deg);
  content: '';
}

.stair-panel__metric-bars {
  position: absolute;
  inset: 6rpx 2rpx 2rpx;
  display: flex;
  align-items: flex-end;
  gap: 6rpx;
}

.stair-panel__metric-bar {
  flex: 1 1 0;
  border-radius: 6rpx 6rpx 0 0;
  background: currentColor;
}

.stair-panel__metric-bar--1 {
  height: 18rpx;
}

.stair-panel__metric-bar--2 {
  height: 28rpx;
}

.stair-panel__metric-bar--3 {
  height: 38rpx;
}

.stair-panel__metric-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
}

.stair-panel__metric-label {
  color: #627189;
  font-size: 22rpx;
  line-height: 1.3;
  font-weight: 800;
}

.stair-panel__metric-value {
  color: #22324a;
  font-size: 62rpx;
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.05em;
}

.stair-panel__metric-unit {
  color: #627189;
  font-size: 22rpx;
  line-height: 1.3;
  font-weight: 700;
}

.stair-panel__actions {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.92fr);
  gap: 20rpx;
  margin-top: auto;
  padding-top: 34rpx;
}

.stair-panel__primary-action,
.stair-panel__secondary-action {
  position: relative;
  display: inline-flex;
  min-height: 108rpx;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  border: none;
  border-radius: 9999px;
  font-size: 28rpx;
  line-height: 1.2;
  font-weight: 900;
}

.stair-panel__primary-action::after,
.stair-panel__secondary-action::after {
  border: none;
}

.stair-panel__primary-action {
  background: linear-gradient(135deg, #ffd781, #ffc861);
  color: #1f2f47;
  box-shadow: 0 12rpx 0 #e3b34d;
}

.stair-panel__primary-action[disabled] {
  opacity: 0.76;
}

.stair-panel__primary-action--pressed {
  transform: translateY(4rpx);
  box-shadow: 0 8rpx 0 #e3b34d;
}

.stair-panel__secondary-action {
  background: linear-gradient(135deg, rgba(238, 242, 249, 0.98), rgba(226, 232, 241, 0.98));
  color: #526177;
  box-shadow: 0 12rpx 0 rgba(204, 212, 224, 0.86);
}

.stair-panel__secondary-action--pressed {
  transform: translateY(4rpx);
  box-shadow: 0 8rpx 0 rgba(204, 212, 224, 0.86);
}

.stair-panel__action-disc {
  display: inline-flex;
  width: 54rpx;
  height: 54rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
}

.stair-panel__play-triangle {
  width: 0;
  height: 0;
  margin-left: 6rpx;
  border-top: 12rpx solid transparent;
  border-bottom: 12rpx solid transparent;
  border-left: 18rpx solid #ff9a3c;
}

.stair-panel__exit-icon {
  position: relative;
  width: 42rpx;
  height: 42rpx;
}

.stair-panel__exit-door {
  position: absolute;
  left: 4rpx;
  top: 4rpx;
  width: 22rpx;
  height: 30rpx;
  border: 4rpx solid currentColor;
  border-right: none;
  border-radius: 8rpx 0 0 8rpx;
}

.stair-panel__exit-arrow {
  position: absolute;
  right: 0;
  top: 14rpx;
  width: 22rpx;
  height: 12rpx;
  background: currentColor;
  clip-path: polygon(0 32%, 58% 32%, 58% 0, 100% 50%, 58% 100%, 58% 68%, 0 68%);
}
</style>
