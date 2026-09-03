<script setup lang="ts">
import { computed } from 'vue'
import { CDN_IMAGE_URLS } from '../../config/cdnAssets'
import { useStudentStore } from '../../uni-app/composables/useStudentStore'

interface AngleScore {
  key: string
  label: string
  score: number
}

const props = defineProps<{
  angles: AngleScore[]
}>()

const studentStore = useStudentStore()
const figureSrc = computed(() => studentStore.state.profile.gender === '女'
  ? CDN_IMAGE_URLS.trainingFeedbackBodyMapFemale
  : CDN_IMAGE_URLS.trainingFeedbackBodyMap)

const anglePositions: Record<string, { side: 'left' | 'right'; top: number }> = {
  left_shoulder: { side: 'left', top: 13 },
  right_shoulder: { side: 'right', top: 13 },
  left_elbow: { side: 'left', top: 29 },
  right_elbow: { side: 'right', top: 29 },
  torso_rotation: { side: 'left', top: 45 },
  left_hip: { side: 'left', top: 56 },
  right_hip: { side: 'right', top: 56 },
  left_knee: { side: 'left', top: 74 },
  right_knee: { side: 'right', top: 74 }
}

const visibleAngles = computed(() => props.angles
  .filter(angle => anglePositions[angle.key])
  .map(angle => ({ ...angle, ...anglePositions[angle.key] })))

function scoreTone(score: number) {
  if (score >= 85) return 'strong'
  if (score >= 70) return 'steady'
  return 'focus'
}
</script>

<template>
  <view class="body-map" aria-label="身体部位角度评分">
    <image
      class="body-map__figure"
      :src="figureSrc"
      mode="aspectFit"
      aria-hidden="true"
    />

    <view
      v-for="angle in visibleAngles"
      :key="angle.key"
      class="body-map__callout"
      :class="[
        `body-map__callout--${angle.side}`,
        `body-map__callout--${scoreTone(angle.score)}`
      ]"
      :style="{ top: `${angle.top}%` }"
    >
      <text class="body-map__label">{{ angle.label }}</text>
      <text class="body-map__score">{{ Math.round(angle.score) }}</text>
    </view>

    <view v-if="visibleAngles.length === 0" class="body-map__empty">
      <text>本次未开启独立角度评分</text>
    </view>
  </view>
</template>

<style scoped>
.body-map {
  position: relative;
  width: 100%;
  height: 470rpx;
  overflow: hidden;
  border-radius: 26rpx;
  background: rgba(241, 247, 250, 0.76);
}

.body-map__figure {
  position: absolute;
  top: 22rpx;
  bottom: 18rpx;
  left: 50%;
  width: 226rpx;
  height: 430rpx;
  transform: translateX(-50%);
}

.body-map__callout {
  position: absolute;
  z-index: 1;
  display: flex;
  min-width: 118rpx;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  padding: 8rpx 10rpx;
  border: 2rpx solid rgba(137, 207, 255, 0.36);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.92);
  box-sizing: border-box;
  color: #4f6575;
  transform: translateY(-50%);
}

.body-map__callout::after {
  position: absolute;
  top: 50%;
  width: 34rpx;
  height: 2rpx;
  background: currentColor;
  content: '';
  opacity: 0.55;
}

.body-map__callout--left { left: 12rpx; }
.body-map__callout--right { right: 12rpx; }
.body-map__callout--left::after { right: -34rpx; }
.body-map__callout--right::after { left: -34rpx; }

.body-map__callout--strong { color: #397565; }
.body-map__callout--steady { color: #9a6a25; }
.body-map__callout--focus { color: #b75d56; }

.body-map__label {
  max-width: 84rpx;
  overflow: hidden;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.body-map__score {
  color: #203042;
  font-size: 22rpx;
  font-weight: 900;
}

.body-map__empty {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  left: 18rpx;
  padding: 12rpx 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #718096;
  font-size: 20rpx;
  font-weight: 700;
  text-align: center;
}
</style>
