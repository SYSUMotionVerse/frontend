<script setup lang="ts">
import { computed } from 'vue'
import type { TrainingModality } from '../../types/student'

const props = defineProps<{
  modality: TrainingModality
  title: string
  description: string
  duration: string
  difficulty: string
  cardIndex: number
}>()

const emit = defineEmits<{
  choose: [modality: TrainingModality]
}>()

const posterBars = [1, 2, 3]

const modeMeta = computed(() => {
  if (props.modality === 'wushu') {
    return {
      accentLabel: '流动招式',
      buttonLabel: '开始这一关',
      buttonIcon: '🥋',
      buttonClass: 'training-level-card__cta--coral',
      difficultyClass: 'training-level-card__pill--gold',
      posterClass: 'training-level-card__poster--wushu',
      posterMark: '武',
      posterIcon: '↗'
    }
  }

  if (props.modality === 'hiit') {
    return {
      accentLabel: '爆发冲刺',
      buttonLabel: '点燃节奏',
      buttonIcon: '⚡',
      buttonClass: 'training-level-card__cta--sky',
      difficultyClass: 'training-level-card__pill--rose',
      posterClass: 'training-level-card__poster--hiit',
      posterMark: '燃',
      posterIcon: '•'
    }
  }

  return {
    accentLabel: '快速登阶',
    buttonLabel: '轻快出发',
    buttonIcon: '👟',
    buttonClass: 'training-level-card__cta--amber',
    difficultyClass: 'training-level-card__pill--sage',
    posterClass: 'training-level-card__poster--stair',
    posterMark: '阶',
    posterIcon: '∎'
  }
})

function handleChoose() {
  emit('choose', props.modality)
}
</script>

<template>
  <view :class="['training-level-card', `training-level-card--${props.modality}`]">
    <view class="training-level-card__glow" :class="`training-level-card__glow--${props.modality}`" />

    <view class="training-level-card__meta">
      <view class="training-level-card__pill training-level-card__pill--neutral">
        <text>{{ props.duration }}</text>
      </view>
      <view class="training-level-card__pill" :class="modeMeta.difficultyClass">
        <text>{{ props.difficulty }}</text>
      </view>
    </view>

    <view class="training-level-card__poster" :class="modeMeta.posterClass">
      <text class="training-level-card__poster-mark">{{ modeMeta.posterMark }}</text>
      <text class="training-level-card__poster-icon">{{ modeMeta.posterIcon }}</text>
      <view
        v-if="props.modality === 'stair'"
        class="training-level-card__poster-steps"
      >
        <view
          v-for="bar in posterBars"
          :key="bar"
          class="training-level-card__poster-step"
          :class="`training-level-card__poster-step--${bar}`"
        />
      </view>
    </view>

    <view class="training-level-card__copy">
      <view class="training-level-card__kicker">
        <text>第 {{ props.cardIndex + 1 }} 关 · {{ modeMeta.accentLabel }}</text>
      </view>
      <text class="training-level-card__title">{{ props.title }}</text>
      <text class="training-level-card__description">{{ props.description }}</text>
    </view>

    <button
      class="training-level-card__cta"
      :class="modeMeta.buttonClass"
      form-type="button"
      hover-class="training-level-card__cta--pressed"
      type="button"
      @click="handleChoose"
    >
      <text>{{ modeMeta.buttonLabel }} {{ modeMeta.buttonIcon }}</text>
    </button>
  </view>
</template>

<style scoped>
.training-level-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  min-height: 296rpx;
  padding: 30rpx 28rpx 28rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 22rpx 46rpx rgba(37, 47, 61, 0.08),
    0 10rpx 0 rgba(255, 236, 213, 0.85);
  overflow: hidden;
}

.training-level-card--wushu { background: #fffaf6; }
.training-level-card--hiit { background: #f7fbff; }
.training-level-card--stair { background: #fffaf1; }

.training-level-card__glow {
  position: absolute;
  right: -36rpx;
  bottom: -48rpx;
  width: 180rpx;
  height: 180rpx;
  border-radius: 9999px;
  opacity: 0.9;
  pointer-events: none;
}

.training-level-card__glow--wushu {
  background: rgba(255, 177, 177, 0.28);
}

.training-level-card__glow--hiit {
  background: rgba(184, 225, 255, 0.3);
}

.training-level-card__glow--stair {
  background: rgba(255, 221, 153, 0.26);
}

.training-level-card__meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  max-width: 360rpx;
  flex-wrap: wrap;
}

.training-level-card__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding: 8rpx 18rpx;
  border-radius: 9999px;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.training-level-card__pill--neutral {
  background: #edf4ff;
  color: #5c6c84;
}

.training-level-card__pill--gold {
  background: #ffecc2;
  color: #866100;
}

.training-level-card__pill--rose {
  background: #ffe2e4;
  color: #df6c88;
}

.training-level-card__pill--sage {
  background: #eef2d6;
  color: #6f7f3a;
}

.training-level-card__poster {
  position: absolute;
  top: 22rpx;
  right: 22rpx;
  display: flex;
  width: 156rpx;
  height: 132rpx;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 18rpx 16rpx;
  border-radius: 30rpx 30rpx 16rpx 16rpx;
  overflow: hidden;
}

.training-level-card__poster--wushu {
  background:
    linear-gradient(135deg, rgba(255, 241, 220, 0.96), rgba(255, 187, 150, 0.95)),
    #ffe8d1;
}

.training-level-card__poster--hiit {
  background:
    linear-gradient(135deg, rgba(255, 245, 232, 0.95), rgba(198, 228, 249, 0.95)),
    #eef6ff;
}

.training-level-card__poster--stair {
  background:
    linear-gradient(180deg, rgba(255, 244, 222, 0.94), rgba(242, 214, 169, 0.98)),
    #f7e5c8;
}

.training-level-card--hiit .training-level-card__poster {
  top: 24rpx;
  right: 26rpx;
  width: 116rpx;
  height: 116rpx;
  padding: 14rpx;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
}

.training-level-card--hiit .training-level-card__poster-mark {
  font-size: 52rpx;
}

.training-level-card--hiit .training-level-card__poster-icon {
  top: 8rpx;
  right: 20rpx;
  font-size: 26rpx;
}

.training-level-card--stair .training-level-card__poster {
  top: 28rpx;
  right: 22rpx;
  width: 178rpx;
  height: 106rpx;
  border-radius: 52rpx 24rpx 52rpx 24rpx;
}

.training-level-card--stair .training-level-card__poster-mark {
  font-size: 54rpx;
}

.training-level-card--stair .training-level-card__poster-icon {
  top: 10rpx;
  right: 16rpx;
  font-size: 30rpx;
}

.training-level-card--hiit .training-level-card__glow {
  right: -12rpx;
  bottom: -70rpx;
  width: 148rpx;
  height: 148rpx;
}

.training-level-card--stair .training-level-card__glow {
  right: -54rpx;
  bottom: -38rpx;
  width: 210rpx;
  height: 128rpx;
  border-radius: 64rpx 0 0 0;
}

.training-level-card__poster-mark {
  position: relative;
  z-index: 1;
  color: rgba(37, 47, 61, 0.72);
  font-size: 60rpx;
  line-height: 1;
  font-weight: 900;
}

.training-level-card__poster-icon {
  position: absolute;
  top: 12rpx;
  right: 14rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 34rpx;
  line-height: 1;
  font-weight: 900;
}

.training-level-card__poster-steps {
  position: absolute;
  right: 18rpx;
  bottom: 14rpx;
  display: flex;
  align-items: flex-end;
  gap: 8rpx;
}

.training-level-card__poster-step {
  width: 20rpx;
  border-radius: 10rpx 10rpx 0 0;
  background: rgba(113, 77, 34, 0.62);
}

.training-level-card__poster-step--1 {
  height: 42rpx;
}

.training-level-card__poster-step--2 {
  height: 66rpx;
}

.training-level-card__poster-step--3 {
  height: 92rpx;
}

.training-level-card__copy {
  display: flex;
  max-width: 420rpx;
  min-height: 126rpx;
  flex-direction: column;
  gap: 10rpx;
  padding-top: 4rpx;
}

.training-level-card__kicker {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  padding: 8rpx 14rpx;
  border-radius: 9999px;
  background: rgba(247, 239, 223, 0.92);
  color: #8a6f52;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.training-level-card__title {
  display: block;
  color: #243244;
  font-size: 38rpx;
  line-height: 1.18;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.training-level-card__description {
  display: block;
  color: #6d7a8b;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.training-level-card__cta {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 80rpx;
  margin-top: 4rpx;
  border: 0;
  border-radius: 9999px;
  padding: 0 24rpx;
  font-size: 28rpx;
  font-weight: 900;
  letter-spacing: 0.02em;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.training-level-card__cta--coral {
  background: linear-gradient(135deg, #ff7e87, #ff9a9e);
  box-shadow: 0 10rpx 0 rgba(237, 121, 130, 0.34);
  color: #ffffff;
}

.training-level-card__cta--sky {
  background: linear-gradient(135deg, #b7dcff, #a5d1ff);
  box-shadow: 0 10rpx 0 rgba(140, 184, 226, 0.34);
  color: #29415d;
}

.training-level-card__cta--amber {
  background: linear-gradient(135deg, #ffd47f, #ffcb63);
  box-shadow: 0 10rpx 0 rgba(227, 176, 71, 0.34);
  color: #5a4320;
}

.training-level-card__cta--pressed,
.training-level-card__cta:active {
  transform: translateY(4rpx);
  box-shadow: 0 6rpx 0 rgba(37, 47, 61, 0.16);
}
</style>
