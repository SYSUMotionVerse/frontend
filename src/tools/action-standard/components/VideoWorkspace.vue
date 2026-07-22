<script setup lang="ts">
import { CircleAlert, Play, Square } from '@lucide/vue'
import type { ActionVideoItem } from '../types'

defineProps<{
  item: ActionVideoItem
  busy: boolean
}>()

defineEmits<{
  analyze: []
  cancel: []
}>()

function formatDuration(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}
</script>

<template>
  <section class="workspace-panel" aria-labelledby="preview-title">
    <div class="section-heading workspace-heading">
      <div>
        <p class="eyebrow">当前视频</p>
        <h2 id="preview-title">{{ item.file.name }}</h2>
      </div>
      <span class="duration-badge">{{ formatDuration(item.duration) }}</span>
    </div>

    <video class="video-preview" :src="item.objectUrl" controls playsinline />

    <div v-if="item.status === 'analyzing'" class="analysis-progress" aria-live="polite">
      <div class="progress-copy">
        <strong>正在提取姿态角度</strong>
        <span>{{ item.detectedFrames }} / {{ item.totalFrames }} 帧检测到人体</span>
      </div>
      <div class="progress-track"><span :style="{ width: `${item.progress}%` }" /></div>
    </div>

    <div v-else-if="item.status === 'error'" class="error-message" role="alert">
      <CircleAlert :size="18" aria-hidden="true" />
      <span>{{ item.error }}</span>
    </div>

    <div v-else-if="item.status === 'ready'" class="ready-summary">
      <strong>{{ item.output?.standard_sequence.length }} 帧</strong>
      <span>角度序列已生成，可继续修改标注后重新分析</span>
    </div>

    <button v-if="busy" class="secondary-button" type="button" @click="$emit('cancel')">
      <Square :size="17" aria-hidden="true" />
      取消分析
    </button>
    <button v-else class="primary-button" type="button" @click="$emit('analyze')">
      <Play :size="17" fill="currentColor" aria-hidden="true" />
      {{ item.status === 'ready' ? '重新分析' : '分析当前视频' }}
    </button>
  </section>
</template>
