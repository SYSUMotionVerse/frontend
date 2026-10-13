<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import type { SignaturePixels } from '../../uni-app/platform/signatureOcr'

const props = defineProps<{ visible: boolean, name: string, busy: boolean, error: string }>()
const emit = defineEmits<{
  close: []
  complete: [value: { imageBase64: string, pixels: SignaturePixels }]
}>()
const instance = getCurrentInstance()?.proxy
const width = Math.max(240, uni.getSystemInfoSync().windowWidth - 48)
const height = 170
const hasInk = shallowRef(false)
let context: ReturnType<typeof uni.createCanvasContext> | undefined
let drawing = false
let drawPending = false
let destroyed = false

function reset() {
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
  if (!visible) return
  await nextTick()
  reset()
})

function point(event: unknown) {
  return (event as { touches: Array<{ x: number, y: number }> }).touches[0]
}
function start(event: unknown) {
  if (props.busy || drawPending) return
  const touch = point(event)
  if (!touch || !context) return
  drawing = true
  context.beginPath()
  context.moveTo(touch.x, touch.y)
}
function move(event: unknown) {
  const touch = point(event)
  if (!drawing || !context || !touch || props.busy) return
  context.lineTo(touch.x, touch.y)
  context.stroke()
  context.draw(true)
  hasInk.value = true
}
function end() { drawing = false }

async function finish() {
  if (!hasInk.value || props.busy || drawPending || !context) return
  drawing = false
  drawPending = true
  try {
    await new Promise<void>(resolve => context!.draw(true, () => resolve()))
    const pixels = await new Promise<SignaturePixels>((resolve, reject) => uni.canvasGetImageData({
      canvasId: 'consentSignature', x: 0, y: 0, width, height,
      success: result => resolve({ data: new Uint8ClampedArray(result.data), width, height }), fail: reject
    }, instance))
    const path = await new Promise<string>((resolve, reject) => uni.canvasToTempFilePath({
      canvasId: 'consentSignature', fileType: 'png', width, height, destWidth: width * 2, destHeight: height * 2,
      success: result => resolve(result.tempFilePath), fail: reject
    }, instance))
    const imageBase64 = await new Promise<string>((resolve, reject) => uni.getFileSystemManager().readFile({
      filePath: path, encoding: 'base64', success: result => resolve(String(result.data)), fail: reject
    }))
    if (!destroyed && props.visible) emit('complete', { imageBase64, pixels })
  } catch {
    void uni.showToast({ title: '签名图片生成失败，请重新签名。', icon: 'none' })
  } finally { drawPending = false }
}

onBeforeUnmount(() => { destroyed = true })
</script>

<template>
  <view v-if="visible" class="signature-mask" @touchmove.stop.prevent>
    <view class="signature-sheet">
      <view class="signature-heading"><text>手写电子签名</text><button :disabled="busy" @click="emit('close')">关闭</button></view>
      <text class="signature-instruction">请用楷体清晰书写完整姓名，与登记姓名“{{ name }}”一致。</text>
      <canvas canvas-id="consentSignature" id="consentSignature" class="signature-canvas" :style="{ width: `${width}px`, height: `${height}px` }" @touchstart.stop.prevent="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="end" />
      <text v-if="error" class="signature-error">{{ error }}</text>
      <view class="signature-actions"><button class="signature-clear" :disabled="busy" @click="reset">重写</button><button class="signature-done" :disabled="!hasInk || busy" @click="finish">{{ busy ? '正在识别并保存…' : '完成' }}</button></view>
    </view>
  </view>
</template>

<style scoped>
.signature-mask{position:fixed;inset:0;background:rgba(24,39,51,.38);z-index:1000;display:flex;align-items:flex-end}.signature-sheet{width:100%;min-height:50vh;box-sizing:border-box;padding:30rpx 24px calc(30rpx + env(safe-area-inset-bottom));background:#fcf7f0;border-radius:36rpx 36rpx 0 0}.signature-heading{display:flex;align-items:center;justify-content:space-between;font-size:34rpx;font-weight:700;color:#203344}.signature-heading button{margin:0;background:transparent;font-size:26rpx}.signature-instruction{display:block;margin:18rpx 0;color:#526270;font-size:28rpx;line-height:1.6}.signature-canvas{background:#fff;border:2rpx dashed #d59182;border-radius:20rpx;overflow:hidden}.signature-error{display:block;color:#a4473b;font-size:25rpx;margin-top:12rpx}.signature-actions{display:flex;gap:24rpx;margin-top:24rpx}.signature-actions button{flex:1;border-radius:20rpx;font-size:30rpx}.signature-clear{color:#667584;background:#fff}.signature-done{background:#ff8580;color:#fff}.signature-done[disabled]{background:#efdfd7;color:#9ba4ae}
</style>
