<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, watch } from 'vue'

interface TrendPoint {
  date: string
  score: number
}

const props = defineProps<{
  chartId: string
  points: TrendPoint[]
}>()

const instance = getCurrentInstance()

function drawChart() {
  if (props.points.length < 2 || typeof uni === 'undefined') return
  if (typeof uni.createSelectorQuery !== 'function' || typeof uni.createCanvasContext !== 'function') return

  const query = uni.createSelectorQuery()
  if (instance?.proxy && typeof query.in === 'function') query.in(instance.proxy)
  query.select('.feedback-trend__canvas').boundingClientRect((rect) => {
    if (!rect || Array.isArray(rect)) return
    const width = rect.width ?? 300
    const height = rect.height ?? 120
    const context = uni.createCanvasContext(props.chartId, instance?.proxy as never)
    const inset = { top: 18, right: 14, bottom: 28, left: 28 }
    const plotWidth = width - inset.left - inset.right
    const plotHeight = height - inset.top - inset.bottom
    const values = props.points.map(point => Math.max(0, Math.min(100, point.score)))

    context.clearRect(0, 0, width, height)
    context.setStrokeStyle('rgba(113, 128, 150, 0.18)')
    context.setLineWidth(1)
    for (const score of [0, 50, 100]) {
      const y = inset.top + plotHeight * (1 - score / 100)
      context.beginPath()
      context.moveTo(inset.left, y)
      context.lineTo(width - inset.right, y)
      context.stroke()
    }

    context.setStrokeStyle('#ff8b8b')
    context.setLineWidth(3)
    context.setLineCap('round')
    context.setLineJoin('round')
    context.beginPath()
    values.forEach((score, index) => {
      const x = inset.left + (plotWidth * index / Math.max(1, values.length - 1))
      const y = inset.top + plotHeight * (1 - score / 100)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()

    values.forEach((score, index) => {
      const x = inset.left + (plotWidth * index / Math.max(1, values.length - 1))
      const y = inset.top + plotHeight * (1 - score / 100)
      context.setFillStyle('#fffaf4')
      context.setStrokeStyle('#ff8b8b')
      context.setLineWidth(2)
      context.beginPath()
      context.arc(x, y, 4, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    })

    context.setFillStyle('#8a97a8')
    context.setFontSize(10)
    context.setTextAlign('center')
    const firstDate = props.points[0]?.date.slice(5) ?? ''
    const lastDate = props.points.at(-1)?.date.slice(5) ?? ''
    context.fillText(firstDate, inset.left, height - 8)
    context.fillText(lastDate, width - inset.right, height - 8)
    context.draw()
  }).exec()
}

function scheduleDraw() {
  void nextTick(drawChart)
}

onMounted(scheduleDraw)
watch(() => props.points, scheduleDraw, { deep: true })
</script>

<template>
  <view class="feedback-trend">
    <canvas
      v-if="points.length >= 2"
      class="feedback-trend__canvas"
      :canvas-id="chartId"
      :id="chartId"
    />
    <view v-else class="feedback-trend__empty">
      <text>{{ points.length === 1 ? '再完成一次同类动作后，这里会形成趋势线。' : '暂无可对比的历史评分。' }}</text>
    </view>
  </view>
</template>

<style scoped>
.feedback-trend {
  width: 100%;
}

.feedback-trend__canvas {
  display: block;
  width: 100%;
  height: 220rpx;
}

.feedback-trend__empty {
  padding: 28rpx 22rpx;
  border-radius: 20rpx;
  background: rgba(241, 245, 249, 0.72);
  color: #718096;
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
}
</style>
