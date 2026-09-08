<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, watch } from 'vue'
import { CDN_IMAGE_URLS } from '../../config/cdnAssets'
import { useStudentStore } from '../../uni-app/composables/useStudentStore'

interface AngleScore {
  key: string
  label: string
  score: number
}

const props = defineProps<{
  angles: AngleScore[]
  gender?: '男' | '女'
}>()

interface AnglePosition {
  side: 'left' | 'right'
  region: 'upper' | 'core' | 'lower'
  top: number
  targetX: number
  targetY: number
}

interface LayoutRect {
  left: number
  top: number
  width: number
  height: number
}

interface CanvasNodeRect {
  node?: HTMLCanvasElement
  width?: number
  height?: number
}

const instance = getCurrentInstance()
const canvasId = `body-map-connectors-${instance?.uid ?? 'feedback'}`
const studentStore = useStudentStore()
const figureSrc = computed(() => (props.gender ?? studentStore.state.profile.gender) === '女'
  ? CDN_IMAGE_URLS.trainingFeedbackBodyMapFemale
  : CDN_IMAGE_URLS.trainingFeedbackBodyMap)

const anglePositions: Record<string, AnglePosition> = {
  left_shoulder: { side: 'left', region: 'upper', top: 10, targetX: 45, targetY: 29 },
  right_shoulder: { side: 'right', region: 'upper', top: 10, targetX: 55, targetY: 29 },
  left_elbow: { side: 'left', region: 'upper', top: 30, targetX: 43, targetY: 40 },
  right_elbow: { side: 'right', region: 'upper', top: 30, targetX: 57, targetY: 40 },
  torso_rotation: { side: 'left', region: 'core', top: 50, targetX: 50, targetY: 38 },
  left_hip: { side: 'left', region: 'lower', top: 70, targetX: 47, targetY: 50 },
  right_hip: { side: 'right', region: 'lower', top: 70, targetX: 53, targetY: 50 },
  left_knee: { side: 'left', region: 'lower', top: 90, targetX: 47, targetY: 60 },
  right_knee: { side: 'right', region: 'lower', top: 90, targetX: 53, targetY: 60 }
}

const visibleAngles = computed(() => props.angles
  .filter(angle => anglePositions[angle.key])
  .map(angle => ({
    ...angle,
    label: angle.key === 'torso_rotation' ? '躯干' : angle.label,
    ...anglePositions[angle.key]
  })))

function connectorColor(region: AnglePosition['region']) {
  if (region === 'upper') return 'rgba(57, 117, 101, 0.76)'
  if (region === 'core') return 'rgba(183, 93, 86, 0.78)'
  return 'rgba(63, 115, 170, 0.76)'
}

function drawConnectors() {
  if (!visibleAngles.value.length || typeof uni === 'undefined') return
  if (typeof uni.createSelectorQuery !== 'function') return

  const query = uni.createSelectorQuery()
  if (instance?.proxy && typeof query.in === 'function') query.in(instance.proxy)
  query.select(`#${canvasId}`).fields({ node: true, size: true }, () => undefined)
  query.select('.body-map').boundingClientRect()
  query.selectAll('.body-map__callout').boundingClientRect()
  query.exec((result) => {
    const canvasRect = result[0] as CanvasNodeRect | undefined
    const container = result[1] as LayoutRect | undefined
    const callouts = result[2] as LayoutRect[] | undefined
    const canvas = canvasRect?.node
    if (!canvas || !container || !Array.isArray(callouts)) return

    const width = canvasRect.width ?? container.width
    const height = canvasRect.height ?? container.height
    const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)

    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(pixelRatio, pixelRatio)
    context.clearRect(0, 0, width, height)
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'

    visibleAngles.value.forEach((angle, index) => {
      const callout = callouts[index]
      if (!callout) return

      const startsOnLeft = angle.side === 'left'
      const startX = (startsOnLeft ? callout.left + callout.width : callout.left) - container.left
      const startY = callout.top + callout.height / 2 - container.top
      const targetX = container.width * angle.targetX / 100
      const targetY = container.height * angle.targetY / 100
      const bendX = startX + (startsOnLeft ? 52 : -52)

      context.strokeStyle = connectorColor(angle.region)
      context.beginPath()
      context.moveTo(startX, startY)
      context.lineTo(bendX, startY)
      context.lineTo(targetX, targetY)
      context.stroke()
    })
  })
}

function scheduleDraw() {
  void nextTick(drawConnectors)
}

onMounted(scheduleDraw)
watch(() => props.angles, scheduleDraw, { deep: true })
watch(figureSrc, scheduleDraw)
</script>

<template>
  <view class="body-map" aria-label="身体部位角度评分">
    <image
      class="body-map__figure"
      :src="figureSrc"
      mode="aspectFit"
      aria-hidden="true"
      @load="scheduleDraw"
    />

    <canvas
      class="body-map__connectors"
      :id="canvasId"
      type="2d"
      aria-hidden="true"
    />

    <view
      v-for="angle in visibleAngles"
      :key="angle.key"
      class="body-map__callout"
      :class="[
        `body-map__callout--${angle.side}`,
        `body-map__callout--${angle.region}`
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
  z-index: 1;
  top: 22rpx;
  bottom: 18rpx;
  left: 50%;
  width: 226rpx;
  height: 430rpx;
  transform: translateX(-50%);
}

.body-map__connectors {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.body-map__callout {
  position: absolute;
  z-index: 3;
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

.body-map__callout--left { left: 12rpx; }
.body-map__callout--right { right: 12rpx; }

.body-map__callout--upper {
  border-color: rgba(57, 117, 101, 0.24);
  color: #397565;
}

.body-map__callout--core {
  border-color: rgba(183, 93, 86, 0.24);
  color: #b75d56;
}

.body-map__callout--lower {
  border-color: rgba(63, 115, 170, 0.24);
  color: #3f73aa;
}

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
