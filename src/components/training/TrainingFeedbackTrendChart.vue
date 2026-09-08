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

interface CanvasNodeRect {
  node?: HTMLCanvasElement
  width?: number
  height?: number
}

function drawChart() {
  if (props.points.length < 2 || typeof uni === 'undefined') return
  if (typeof uni.createSelectorQuery !== 'function') return

  const query = uni.createSelectorQuery()
  if (instance?.proxy && typeof query.in === 'function') query.in(instance.proxy)
  query.select(`#${props.chartId}`).fields({ node: true, size: true }, (result) => {
    if (!result || Array.isArray(result)) return
    const canvasRect = result as CanvasNodeRect
    const canvas = canvasRect.node
    if (!canvas) return

    const width = canvasRect.width ?? 300
    const height = canvasRect.height ?? 120
    const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)

    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(pixelRatio, pixelRatio)
    const inset = { top: 24, right: 30, bottom: 28, left: 30 }
    const plotWidth = width - inset.left - inset.right
    const plotHeight = height - inset.top - inset.bottom
    const values = props.points.map(point => Math.max(0, Math.min(100, point.score)))

    context.clearRect(0, 0, width, height)
    context.strokeStyle = 'rgba(113, 128, 150, 0.18)'
    context.lineWidth = 1
    context.fillStyle = '#718096'
    context.font = '9px sans-serif'
    context.textAlign = 'right'
    for (const score of [0, 25, 50, 75, 100]) {
      const y = inset.top + plotHeight * (1 - score / 100)
      context.beginPath()
      context.moveTo(inset.left, y)
      context.lineTo(width - inset.right, y)
      context.stroke()
      context.fillText(String(score), inset.left - 7, y + 3)
    }

    context.strokeStyle = 'rgba(113, 128, 150, 0.34)'
    context.beginPath()
    context.moveTo(inset.left, inset.top)
    context.lineTo(inset.left, height - inset.bottom)
    context.stroke()

    context.strokeStyle = '#ff8b8b'
    context.lineWidth = 3
    context.lineCap = 'round'
    context.lineJoin = 'round'
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
      context.fillStyle = '#fffaf4'
      context.strokeStyle = '#ff8b8b'
      context.lineWidth = 2
      context.beginPath()
      context.arc(x, y, 4, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      context.fillStyle = '#c75f5f'
      context.font = '10px sans-serif'
      context.textAlign = 'center'
      context.fillText(String(Math.round(score)), x, y < inset.top + 14 ? y + 17 : y - 8)
    })

    context.fillStyle = '#8a97a8'
    context.font = '10px sans-serif'
    context.textAlign = 'center'
    const firstDate = props.points[0]?.date.slice(5) ?? ''
    const lastDate = props.points.at(-1)?.date.slice(5) ?? ''
    context.fillText(firstDate, inset.left, height - 8)
    context.fillText(lastDate, width - inset.right, height - 8)
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
      :id="chartId"
      type="2d"
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
  height: 240rpx;
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
