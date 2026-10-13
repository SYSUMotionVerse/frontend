<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { stageSignatureImage, type SignatureCompletion } from '../../uni-app/platform/signatureImageHandoff'
import { signatureOperation } from '../../uni-app/platform/signatureOperation'
import { createSignatureImage, yieldSignatureUi, type SignatureSegment, type SignatureDraft } from '../../uni-app/platform/signatureImage'
import { SIGNATURE_REWRITE_MESSAGE, SIGNATURE_UNSUPPORTED_MESSAGE } from '../../uni-app/platform/signaturePresentation'

const props = defineProps<{ visible: boolean, name: string, busy: boolean, error: string, handoffId: string, draft?: SignatureDraft | null }>()
const emit = defineEmits<{
  ready: []
  close: []
  complete: [value: SignatureCompletion]
  change: [draft: SignatureDraft]
}>()
const instance = getCurrentInstance()?.proxy
const width = Math.min(720, Math.max(200, uni.getSystemInfoSync().windowWidth - 56))
const height = 190
const strokes = shallowRef<SignatureSegment[][]>([])
const hasInk = computed(() => strokes.value.length > 0)
const rendered = shallowRef(false)
const entered = shallowRef(false)
const canvasVisible = shallowRef(false)
const ready = shallowRef(false)
let context: ReturnType<typeof uni.createCanvasContext> | undefined
let previousPoint: { x: number, y: number } | null = null
const drawPending = shallowRef(false)
const exportError = shallowRef('')
let revision = 0
let currentStroke: SignatureSegment[] | null = null
let destroyed = false
let presentation = 0
let animationTimer: ReturnType<typeof setTimeout> | undefined

function publishDraft() {
  emit('change', { width, height, strokes: strokes.value.map(stroke => stroke.map(segment => [...segment] as SignatureSegment)) })
}
async function waitForCanvas() {
  await nextTick()
  await signatureOperation<void>((resolve, reject) => {
    if (typeof uni.createSelectorQuery !== 'function') { yieldSignatureUi().then(resolve); return }
    uni.createSelectorQuery().in(instance).select('#consentSignature').boundingClientRect(rect => {
      const node = rect as UniApp.NodeInfo | null
      if (node?.width && node.height) resolve()
      else reject(new Error('signature_canvas_view_pending'))
    }).exec()
  }, 'signature_canvas_not_ready', 1500)
}
async function redraw() {
  const attempt = ++revision
  drawPending.value = false
  exportError.value = ''
  previousPoint = null
  currentStroke = null
  ready.value = false
  const current = () => !destroyed && props.visible && canvasVisible.value && revision === attempt
  if (!current()) return
  if (!context) {
    // Vue's nextTick does not guarantee that the native canvas is mounted.
    // A selector response comes from the rendered mini-program view.
    await waitForCanvas()
    if (!current()) return
    context = uni.createCanvasContext('consentSignature', instance)
  }
  context.setFillStyle('#ffffff')
  context.fillRect(0, 0, width, height)
  context.setStrokeStyle('#203344')
  context.setLineWidth(3)
  context.setLineCap('round')
  context.setLineJoin('round')
  context.draw()
  let batch = 0
  for (const stroke of strokes.value) for (const [x1, y1, x2, y2] of stroke) {
    if (!current()) return
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
    if (++batch === 32) { context.draw(true); batch = 0; await yieldSignatureUi() }
  }
  if (!current()) return
  if (batch) context.draw(true)
  ready.value = true
  emit('ready')
}
function renderStrokes() {
  const attempt = revision + 1
  void redraw().catch(() => {
    if (!destroyed && props.visible && revision === attempt) {
      exportError.value = SIGNATURE_REWRITE_MESSAGE
      ready.value = true
    }
  })
}
function reset() {
  strokes.value = []
  publishDraft()
  renderStrokes()
}
function undo() {
  if (!ready.value || props.busy || !strokes.value.length) return
  strokes.value = strokes.value.slice(0, -1)
  publishDraft()
  renderStrokes()
}
function restore() {
  const draft = props.draft
  const scaleX = draft?.width ? width / draft.width : 1
  const scaleY = draft?.height ? height / draft.height : 1
  strokes.value = draft?.strokes.map(stroke => stroke.map(([x1, y1, x2, y2]) => [x1 * scaleX, y1 * scaleY, x2 * scaleX, y2 * scaleY])) ?? []
  renderStrokes()
}

watch(() => props.visible, async visible => {
  const cycle = ++presentation
  clearTimeout(animationTimer)
  revision++
  drawPending.value = false
  ready.value = false
  if (!visible) {
    context = undefined
    previousPoint = null
    currentStroke = null
    canvasVisible.value = false
    entered.value = false
    animationTimer = setTimeout(() => { if (presentation === cycle) rendered.value = false }, 240)
    return
  }
  rendered.value = true
  entered.value = false
  await nextTick()
  if (!props.visible || destroyed || presentation !== cycle) return
  // Give the closed position a render before starting the entrance transition.
  animationTimer = setTimeout(() => {
    if (presentation !== cycle || destroyed) return
    entered.value = true
    animationTimer = setTimeout(async () => {
      if (presentation !== cycle || destroyed) return
      canvasVisible.value = true
      await nextTick()
      if (props.visible && !destroyed && presentation === cycle) restore()
    }, 320)
  }, 20)
}, { immediate: true })

function point(event: unknown) {
  const touch = (event as { touches?: Array<{ x: number, y: number }> }).touches?.[0]
  return touch && Number.isFinite(touch.x) && Number.isFinite(touch.y)
    ? { x: Math.max(0, Math.min(width, touch.x)), y: Math.max(0, Math.min(height, touch.y)) } : null
}
function start(event: unknown) {
  if (!ready.value || !props.visible || props.busy || drawPending.value) return
  const touch = point(event)
  if (!touch || !context) return
  previousPoint = { x: touch.x, y: touch.y }
  currentStroke = []
}
function move(event: unknown) {
  const touch = point(event)
  if (!ready.value || !props.visible || !previousPoint || !context || !touch || props.busy || drawPending.value) return
  // draw() flushes the native command path on Android. Every segment must
  // establish its own origin rather than continuing a flushed path.
  context.beginPath()
  context.moveTo(previousPoint.x, previousPoint.y)
  context.lineTo(touch.x, touch.y)
  context.stroke()
  context.draw(true)
  if (!currentStroke) currentStroke = []
  if (!currentStroke.length) strokes.value = [...strokes.value, currentStroke]
  currentStroke.push([previousPoint.x, previousPoint.y, touch.x, touch.y])
  previousPoint = { x: touch.x, y: touch.y }
}
function end() { previousPoint = null; currentStroke = null; publishDraft() }

async function finish() {
  if (!ready.value || !props.visible || !hasInk.value || props.busy || drawPending.value) return
  end()
  const attempt = ++revision
  const current = () => !destroyed && props.visible && revision === attempt
  drawPending.value = true
  exportError.value = ''
  try {
    const image = await signatureOperation<Awaited<ReturnType<typeof createSignatureImage>>>((resolve, reject) => {
      createSignatureImage(strokes.value.flat(), width, height, () => current() && drawPending.value).then(resolve, reject)
    }, '生成签名图片超时，请重写后重试。', 10000)
    // The known-working sheet keeps its drawing canvas mounted throughout
    // verification. Completion must not tear it down during native startup.
    if (current()) emit('complete', stageSignatureImage(props.handoffId, image))
  } catch {
    if (current()) exportError.value = SIGNATURE_REWRITE_MESSAGE
  } finally {
    if (current()) drawPending.value = false
  }
}

function close() {
  revision++
  drawPending.value = false
  end()
  emit('close')
}

onBeforeUnmount(() => { destroyed = true; revision++; presentation++; clearTimeout(animationTimer) })
</script>

<template>
  <view v-if="rendered" class="signature-mask" :class="{ 'signature-mask--open': entered }" @click="close" @touchmove.stop.prevent>
    <view class="signature-sheet" :class="{ 'signature-sheet--ready': canvasVisible }" @click.stop>
      <view class="signature-heading"><text>手写电子签名</text></view>
      <text class="signature-instruction">请用楷体清晰书写完整姓名，与登记姓名“<text class="signature-name">{{ name }}</text>”一致。</text>
      <view class="signature-frame" :style="{ width: `${width + 8}px`, height: `${height + 8}px` }"><canvas v-if="canvasVisible" canvas-id="consentSignature" id="consentSignature" class="signature-canvas" :style="{ width: `${width}px`, height: `${height}px` }" @touchstart.stop.prevent="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="end" /></view>
      <text v-if="exportError || error" class="signature-error">{{ error === SIGNATURE_UNSUPPORTED_MESSAGE ? SIGNATURE_UNSUPPORTED_MESSAGE : SIGNATURE_REWRITE_MESSAGE }}</text>
      <view class="signature-actions"><button class="signature-clear" :disabled="!ready || busy" @click="reset">重写</button><button class="signature-undo" :disabled="!ready || !hasInk || busy" @click="undo">撤回</button><button class="signature-done" :disabled="!ready || !hasInk || busy || drawPending" @click="finish">{{ drawPending || busy ? '处理中…' : '完成' }}</button></view>
    </view>
  </view>
</template>

<style scoped>
.signature-mask--open .signature-sheet.signature-sheet--ready{transform:none}
.signature-mask{position:fixed;inset:0;background:rgba(24,39,51,0);z-index:1000;display:flex;align-items:flex-end;transition:background-color 240ms cubic-bezier(.7,0,.84,0)}.signature-mask--open{background:rgba(24,39,51,.38);transition-duration:320ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}.signature-sheet{width:100%;min-height:50vh;box-sizing:border-box;padding:30rpx 24px calc(30rpx + env(safe-area-inset-bottom));background:#fcf7f0;border-radius:36rpx 36rpx 0 0;transform:translateY(100%);transition:transform 240ms cubic-bezier(.7,0,.84,0)}.signature-mask--open .signature-sheet{transform:translateY(0);transition-duration:320ms;transition-timing-function:cubic-bezier(.16,1,.3,1)}.signature-heading{display:flex;align-items:center;font-size:34rpx;font-weight:700;color:#203344}.signature-instruction{display:block;margin:18rpx 0;color:#526270;font-size:28rpx;line-height:1.6}.signature-frame{display:block;box-sizing:border-box;padding:3px;border:1px dashed #d59182;background:#fff}.signature-canvas{display:block;background:#fff}.signature-name{font-weight:700}.signature-error{display:block;color:#a4473b;font-size:25rpx;margin-top:12rpx}.signature-actions{display:flex;gap:24rpx;margin-top:24rpx}.signature-actions button{flex:0 0 calc(25% - 12rpx);min-width:0;padding:0;margin:0;box-sizing:border-box;border:1px solid transparent;border-radius:20rpx;overflow:hidden;font-size:30rpx;line-height:2.6}.signature-actions button::after{border:0;border-radius:inherit}.signature-actions .signature-clear,.signature-actions .signature-undo{color:#667584;background:#fff;border-color:#d3d5d5}.signature-actions .signature-done{flex:0 0 calc(50% - 24rpx);background:#ff8580;color:#fff;border-color:#ff8580}.signature-actions .signature-done[disabled]{background:#efdfd7;color:#9ba4ae;border-color:#efdfd7}
</style>
