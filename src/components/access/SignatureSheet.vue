<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import type { SignaturePixels } from '../../uni-app/platform/signatureOcr'
import { signatureOperation } from '../../uni-app/platform/signatureOperation'

const props = defineProps<{ visible: boolean, name: string, busy: boolean, error: string, progress?: string }>()
const emit = defineEmits<{
  close: []
  complete: [value: { imageBase64: string, pixels: SignaturePixels }]
}>()
const instance = getCurrentInstance()?.proxy
const width = Math.max(200, uni.getSystemInfoSync().windowWidth - 56)
const height = 190
const hasInk = shallowRef(false)
let context: ReturnType<typeof uni.createCanvasContext> | undefined
let previousPoint: { x: number, y: number } | null = null
const drawPending = shallowRef(false)
const exportError = shallowRef('')
const exportProgress = shallowRef('')
let revision = 0
const segments: Array<[number, number, number, number]> = []
let destroyed = false

function reset() {
  revision++
  drawPending.value = false
  exportError.value = ''
  exportProgress.value = ''
  segments.length = 0
  previousPoint = null
  context = uni.createCanvasContext('consentSignature', instance)
  context.setFillStyle('#ffffff')
  context.fillRect(0, 0, width, height)
  context.setStrokeStyle('#203344')
  context.setLineWidth(3)
  context.setLineCap('round')
  context.setLineJoin('round')
  context.draw()
  hasInk.value = false
}

watch(() => props.visible, async visible => {
  if (!visible) { revision++; drawPending.value = false; return }
  await nextTick()
  if (props.visible && !destroyed) reset()
}, { immediate: true })

function point(event: unknown) {
  const touch = (event as { touches?: Array<{ x: number, y: number }> }).touches?.[0]
  return touch && Number.isFinite(touch.x) && Number.isFinite(touch.y) ? touch : null
}
function start(event: unknown) {
  if (props.busy || drawPending.value) return
  const touch = point(event)
  if (!touch || !context) return
  previousPoint = { x: touch.x, y: touch.y }
}
function move(event: unknown) {
  const touch = point(event)
  if (!previousPoint || !context || !touch || props.busy || drawPending.value) return
  // draw() flushes the native command path on Android. Every segment must
  // establish its own origin rather than continuing a flushed path.
  context.beginPath()
  context.moveTo(previousPoint.x, previousPoint.y)
  context.lineTo(touch.x, touch.y)
  context.stroke()
  context.draw(true)
  segments.push([previousPoint.x, previousPoint.y, touch.x, touch.y])
  previousPoint = { x: touch.x, y: touch.y }
  hasInk.value = true
}
function end() { previousPoint = null }

async function finish() {
  if (!hasInk.value || props.busy || drawPending.value || !context) return
  previousPoint = null
  const attempt = ++revision
  const current = () => !destroyed && props.visible && revision === attempt
  drawPending.value = true
  exportError.value = ''
  exportProgress.value = '正在生成签名图片…'
  try {
    // Flush real drawing commands. An empty draw() can omit its callback on
    // Android; replay the captured strokes instead of waiting for that no-op.
    context.setFillStyle('#ffffff')
    context.fillRect(0, 0, width, height)
    context.setStrokeStyle('#203344')
    context.setLineWidth(3)
    context.setLineCap('round')
    context.setLineJoin('round')
    for (const [x1, y1, x2, y2] of segments) {
      context.beginPath()
      context.moveTo(x1, y1)
      context.lineTo(x2, y2)
      context.stroke()
    }
    await signatureOperation<void>(resolve => context!.draw(false, () => resolve()), '画板绘制超时，请点击重写后重试。', 3000)
    if (!current()) return
    const pixels = await signatureOperation<SignaturePixels>((resolve, reject) => uni.canvasGetImageData({
      canvasId: 'consentSignature', x: 0, y: 0, width, height,
      success: result => resolve({ data: new Uint8ClampedArray(result.data), width, height }), fail: reject
    }, instance), '读取签名画板失败，请重试。')
    if (!current()) return
    const path = await signatureOperation<string>((resolve, reject) => uni.canvasToTempFilePath({
      canvasId: 'consentSignature', fileType: 'png', width, height, destWidth: width * 2, destHeight: height * 2,
      success: result => resolve(result.tempFilePath), fail: reject
    }, instance), '生成签名图片失败，请重试。')
    if (!current()) return
    const imageBase64 = await signatureOperation<string>((resolve, reject) => uni.getFileSystemManager().readFile({
      filePath: path, encoding: 'base64', success: result => resolve(String(result.data)), fail: reject
    }), '读取签名图片失败，请重试。')
    if (current()) emit('complete', { imageBase64, pixels })
  } catch (cause) {
    if (current()) exportError.value = cause instanceof Error ? cause.message : '签名图片生成失败，请重试。'
  } finally {
    if (current()) { drawPending.value = false; exportProgress.value = '' }
  }
}

onBeforeUnmount(() => { destroyed = true; revision++ })
</script>

<template>
  <view v-if="visible" class="signature-mask" @touchmove.stop.prevent>
    <view class="signature-sheet">
      <view class="signature-heading"><text>手写电子签名</text><button :disabled="busy" @click="emit('close')">关闭</button></view>
      <text class="signature-instruction">请用楷体清晰书写完整姓名，与登记姓名“{{ name }}”一致。</text>
      <view class="signature-frame"><canvas canvas-id="consentSignature" id="consentSignature" class="signature-canvas" :style="{ width: `${width}px`, height: `${height}px` }" @touchstart.stop.prevent="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="end" /></view>
      <text v-if="exportError || error" class="signature-error">{{ exportError || error }}</text>
      <text v-if="drawPending || busy" class="signature-progress">{{ drawPending ? exportProgress : (progress || '正在识别并保存…') }}</text>
      <view class="signature-actions"><button class="signature-clear" :disabled="busy" @click="reset">重写</button><button class="signature-done" :disabled="!hasInk || busy || drawPending" @click="finish">{{ drawPending || busy ? '处理中…' : '完成' }}</button></view>
    </view>
  </view>
</template>

<style scoped>
.signature-mask{position:fixed;inset:0;background:rgba(24,39,51,.38);z-index:1000;display:flex;align-items:flex-end}.signature-sheet{width:100%;min-height:50vh;box-sizing:border-box;padding:30rpx 24px calc(30rpx + env(safe-area-inset-bottom));background:#fcf7f0;border-radius:36rpx 36rpx 0 0}.signature-heading{display:flex;align-items:center;justify-content:space-between;font-size:34rpx;font-weight:700;color:#203344}.signature-heading button{margin:0;background:transparent;font-size:26rpx}.signature-instruction{display:block;margin:18rpx 0;color:#526270;font-size:28rpx;line-height:1.6}.signature-frame{display:inline-block;box-sizing:border-box;padding:3px;border:1px dashed #d59182;background:#fff}.signature-canvas{display:block;background:#fff}.signature-progress{display:block;font-size:25rpx;color:#667584;margin-top:12rpx}.signature-error{display:block;color:#a4473b;font-size:25rpx;margin-top:12rpx}.signature-actions{display:flex;gap:24rpx;margin-top:24rpx}.signature-actions button{flex:1;border-radius:20rpx;font-size:30rpx}.signature-clear{color:#667584;background:#fff}.signature-done{background:#ff8580;color:#fff}.signature-done[disabled]{background:#efdfd7;color:#9ba4ae}
</style>
