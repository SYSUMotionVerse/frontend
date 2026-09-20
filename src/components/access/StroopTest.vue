<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { studentBackendSync } from '../../uni-app/api/studentBackend'
import type { BackendPsychologyRecord, StroopColor, StroopStimulus, StroopSubmission } from '../../uni-app/api/studentBackendTypes'

const props = defineProps<{ scaleId: number; studentId: string; active: boolean; interruptionKey: number }>()
const emit = defineEmits<{ completed: [record: BackendPsychologyRecord] }>()
const colors: Array<{ value: StroopColor; label: string; hex: string }> = [
  { value: 'RED', label: '红', hex: '#cf2737' },
  { value: 'GREEN', label: '绿', hex: '#187b39' },
  { value: 'BLUE', label: '蓝', hex: '#245bce' },
  { value: 'YELLOW', label: '黄', hex: '#b78a00' }
]
const phase = ref<'screen' | 'ready' | 'trial' | 'upload' | 'result'>('screen')
const screenAnswers = ref<StroopColor[]>([])
const stimuli = shallowRef<StroopStimulus[]>([])
const sessionId = ref('')
const trialIndex = ref(0)
const accepting = ref(false)
const busy = ref(false)
const error = ref('')
const pending = shallowRef<StroopSubmission | null>(null)
const record = shallowRef<BackendPsychologyRecord | null>(null)
let trials: StroopSubmission['trials'] = []
let trialStarted = 0
let taskStarted = 0
let generation = 0
let renderTimer: ReturnType<typeof setTimeout> | undefined
const storageKey = computed(() => `sport-snack:stroop:v1:${encodeURIComponent(props.studentId)}:${props.scaleId}`)
const stimulus = computed(() => stimuli.value[trialIndex.value])
const ink = computed(() => colors.find(color => color.value === stimulus.value?.ink_color)?.hex)
const screenColor = computed(() => colors[screenAnswers.value.length])
const metrics = computed(() => record.value?.task_result)

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
}
function reset(message = '') {
  generation++
  clearTimeout(renderTimer)
  accepting.value = false
  busy.value = false
  trials = []
  screenAnswers.value = []
  phase.value = 'screen'
  error.value = message
}
function restorePending() {
  try {
    const value = uni.getStorageSync(storageKey.value) as StroopSubmission | undefined
    if (value?.session_id && Array.isArray(value.trials) && value.trials.length === 10
      && Number.isFinite(value.completion_time_ms)) {
      pending.value = value
      phase.value = 'upload'
    }
  } catch { error.value = '本地记录读取失败，请保持此页面完成测试。' }
}
restorePending()

async function answerScreen(color: StroopColor) {
  if (!props.active || busy.value || phase.value !== 'screen') return
  screenAnswers.value.push(color)
  if (screenAnswers.value.length < 4) return
  busy.value = true
  error.value = ''
  const token = generation
  try {
    const response = await studentBackendSync.startStroop(props.scaleId, [...screenAnswers.value])
    if (token !== generation) return
    if (response.already_completed && response.record) {
      record.value = response.record
      phase.value = 'result'
    } else if (!response.screening_passed) {
      reset('辨色未全部正确，请重新辨认四种颜色。')
    } else if (response.stimuli.length === 10) {
      sessionId.value = response.session_id
      stimuli.value = response.stimuli
      phase.value = 'ready'
    } else {
      reset('测试加载失败，请重新尝试。')
    }
  } catch { if (token === generation) reset('网络连接失败，请重新完成辨色。') }
  finally { if (token === generation) busy.value = false }
}

async function presentTrial() {
  accepting.value = false
  const token = generation
  // Timestamp the stimulus update request. Native view latency is device
  // dependent, so these are client response times, not laboratory timings.
  trialStarted = now()
  if (trialIndex.value === 0) taskStarted = trialStarted
  await nextTick()
  if (token !== generation) return
  renderTimer = setTimeout(() => {
    if (token !== generation || !props.active || phase.value !== 'trial') return
    accepting.value = true
  }, 50)
}
function begin() {
  if (!props.active || phase.value !== 'ready') return
  trials = []
  trialIndex.value = 0
  phase.value = 'trial'
  void presentTrial()
}
function answerTrial(color: StroopColor) {
  if (!props.active || !accepting.value || phase.value !== 'trial') return
  accepting.value = false
  const elapsed = Math.max(1, Math.round(now() - trialStarted))
  if (elapsed > 120000) { reset('本试次停留时间过长，请重新开始。'); return }
  trials.push({ selected_color: color, reaction_time_ms: elapsed })
  if (trials.length < 10) {
    trialIndex.value++
    void presentTrial()
    return
  }
  const completion = Math.max(Math.round(now() - taskStarted), trials.reduce((sum, trial) => sum + trial.reaction_time_ms, 0))
  pending.value = { session_id: sessionId.value, trials: [...trials], completion_time_ms: completion }
  phase.value = 'upload'
  void upload()
}
async function upload() {
  if (busy.value || !pending.value || !props.active) return
  busy.value = true
  error.value = ''
  try {
    // Persist before network; retries use exactly the same session and answers.
    uni.setStorageSync(storageKey.value, pending.value)
    const response = await studentBackendSync.submitStroop(props.scaleId, pending.value)
    record.value = response.record
    pending.value = null
    phase.value = 'result'
    try { uni.removeStorageSync(storageKey.value) } catch { /* Idempotent retry remains safe. */ }
  } catch {
    error.value = '成绩尚未上传成功，请重试。若会话已过期，可重新测试。'
  } finally { busy.value = false }
}
function restart() {
  if (busy.value) return
  pending.value = null
  try { uni.removeStorageSync(storageKey.value) } catch { /* A later valid result replaces it. */ }
  reset()
}
function interrupt() {
  // Preserve a finished result awaiting upload; only partial tests restart.
  if (phase.value === 'trial' || phase.value === 'ready' || phase.value === 'screen') {
    reset('已中断，请重新完成辨色并开始测试。')
  }
}
watch(() => props.active, active => { if (!active) interrupt() })
watch(() => props.interruptionKey, interrupt)
onBeforeUnmount(() => { generation++; clearTimeout(renderTimer) })
</script>

<template>
  <view class="stroop">
    <view class="stroop__header"><text class="stroop__title">Stroop 色词测试</text><text>选择字体颜色，忽略单词含义</text></view>
    <view v-if="phase === 'screen'" class="stroop__card">
      <text class="stroop__title">先做辨色检查</text>
      <text>请选择色块对应的颜色（{{ Math.min(screenAnswers.length + 1, 4) }} / 4）</text>
      <view class="stroop__swatch" :style="{ backgroundColor: screenColor?.hex }" />
      <view class="stroop__buttons"><button v-for="color in colors" :key="color.value" :disabled="busy" @click="answerScreen(color.value)">{{ color.label }}</button></view>
    </view>
    <view v-else-if="phase === 'ready'" class="stroop__card">
      <text class="stroop__title">辨色通过，准备开始</text>
      <text>屏幕会依次显示 10 个颜色词。不要读词义，只看字体颜色，尽快点击下方对应按钮。</text>
      <text>请保持小程序在前台，中途离开需要重新开始。</text>
      <button class="stroop__primary" @click="begin">开始测试</button>
    </view>
    <view v-else-if="phase === 'trial'" class="stroop__card">
      <text class="stroop__progress">{{ trialIndex + 1 }} / 10</text>
      <view class="stroop__track"><view :style="{ width: `${trialIndex * 10}%` }" /></view>
      <view class="stroop__stimulus"><text :style="{ color: ink }">{{ stimulus?.word }}</text></view>
      <text>只判断字体颜色</text>
      <view class="stroop__buttons"><button v-for="color in colors" :key="color.value" :disabled="!accepting" @click="answerTrial(color.value)">{{ color.label }}</button></view>
    </view>
    <view v-else-if="phase === 'upload'" class="stroop__card">
      <text class="stroop__title">测试结束</text><text>{{ busy ? '正在保存成绩…' : '成绩等待上传' }}</text>
      <button class="stroop__primary" :disabled="busy" @click="upload">{{ busy ? '正在上传' : '重试上传' }}</button>
      <button v-if="error" :disabled="busy" @click="restart">重新测试</button>
    </view>
    <view v-else class="stroop__card">
      <text class="stroop__title">成绩已保存</text>
      <view v-if="metrics" class="stroop__metrics">
        <text>准确率 <text class="stroop__number">{{ metrics.accuracy_percent }}%</text></text>
        <text>完成时间 <text class="stroop__number">{{ (metrics.completion_time_ms / 1000).toFixed(2) }} 秒</text></text>
        <text>平均反应时间 <text class="stroop__number">{{ (metrics.mean_reaction_time_ms / 1000).toFixed(2) }} 秒</text></text>
      </view>
      <button class="stroop__primary" @click="record && emit('completed', record)">完成并继续</button>
    </view>
    <text v-if="error" class="stroop__error" aria-live="polite">{{ error }}</text>
  </view>
</template>

<style scoped>
.stroop { display:flex; flex-direction:column; gap:28rpx; color:#203042; }
.stroop__header,.stroop__card { display:flex; flex-direction:column; gap:24rpx; }
.stroop__header { padding:12rpx; font-size:26rpx; }
.stroop__title { font-size:36rpx; font-weight:900; }
.stroop__card { background:#fffcf8; border:3rpx solid #f4e7d3; border-radius:32rpx; padding:32rpx; box-shadow:0 8rpx 0 #0000000a; font-size:28rpx; line-height:1.6; }
.stroop__swatch { width:180rpx; height:180rpx; border-radius:24rpx; margin:32rpx auto; }
.stroop__buttons { display:flex; gap:12rpx; width:100%; }
.stroop__buttons button { flex:1; margin:0; padding:0; min-height:100rpx; display:flex; align-items:center; justify-content:center; background:#fff; color:#203042; border:2rpx solid #ced4da; border-radius:20rpx; font-size:34rpx; font-weight:900; }
.stroop__buttons button::after,.stroop__primary::after { border:0; }
.stroop__primary { width:100%; margin:12rpx 0 0; padding:16rpx; border-radius:999rpx; background:#ff8b8b; color:#203042; font-size:30rpx; font-weight:900; box-shadow:0 7rpx 0 #de7272; }
.stroop__stimulus { min-height:280rpx; display:flex; align-items:center; justify-content:center; background:#fff; border-radius:24rpx; font-size:76rpx; font-weight:900; }
.stroop__progress { font-size:30rpx; font-weight:900; }
.stroop__track { height:12rpx; border-radius:12rpx; background:#e8e0d7; overflow:hidden; }
.stroop__track view { height:100%; background:#ff8b8b; }
.stroop__metrics { display:flex; flex-direction:column; gap:20rpx; }
.stroop__number { font-size:34rpx; font-weight:900; }
.stroop__error { color:#8f3f36; padding:24rpx; font-size:26rpx; }
</style>
