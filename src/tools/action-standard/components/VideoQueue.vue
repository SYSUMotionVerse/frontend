<script setup lang="ts">
import { CheckCircle2, CircleAlert, Film, LoaderCircle, Plus, Trash2 } from '@lucide/vue'
import type { ActionVideoItem } from '../types'

defineProps<{
  items: ActionVideoItem[]
  selectedId: string
}>()

const emit = defineEmits<{
  add: [files: File[]]
  remove: [id: string]
  select: [id: string]
}>()

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  emit('add', Array.from(input.files ?? []))
  input.value = ''
}

function statusLabel(item: ActionVideoItem) {
  if (item.status === 'ready') return '已生成'
  if (item.status === 'analyzing') return `${item.progress}%`
  if (item.status === 'error') return '需检查'
  return '待分析'
}
</script>

<template>
  <aside class="queue-panel" aria-label="视频队列">
    <div class="queue-heading">
      <div>
        <p class="eyebrow">视频队列</p>
        <h2>{{ items.length }} 个文件</h2>
      </div>
      <label class="icon-button" title="添加视频">
        <Plus :size="18" aria-hidden="true" />
        <span class="sr-only">添加视频</span>
        <input class="sr-only" type="file" accept="video/*" multiple @change="onFiles" />
      </label>
    </div>

    <label v-if="items.length === 0" class="empty-queue">
      <span class="empty-icon"><Film :size="24" aria-hidden="true" /></span>
      <strong>选择标准动作视频</strong>
      <span>可一次选择多个文件</span>
      <input class="sr-only" type="file" accept="video/*" multiple @change="onFiles" />
    </label>

    <div v-else class="queue-list">
      <button
        v-for="item in items"
        :key="item.id"
        class="queue-item"
        :class="{ 'queue-item--active': item.id === selectedId }"
        type="button"
        @click="emit('select', item.id)"
      >
        <span class="status-icon" :class="`status-icon--${item.status}`">
          <CheckCircle2 v-if="item.status === 'ready'" :size="16" aria-hidden="true" />
          <LoaderCircle v-else-if="item.status === 'analyzing'" class="spin" :size="16" aria-hidden="true" />
          <CircleAlert v-else-if="item.status === 'error'" :size="16" aria-hidden="true" />
          <Film v-else :size="16" aria-hidden="true" />
        </span>
        <span class="queue-copy">
          <strong>{{ item.actionName }}</strong>
          <span>{{ statusLabel(item) }}</span>
        </span>
        <span
          class="remove-button"
          role="button"
          tabindex="0"
          title="移除视频"
          @click.stop="emit('remove', item.id)"
          @keydown.enter.stop="emit('remove', item.id)"
        >
          <Trash2 :size="16" aria-hidden="true" />
        </span>
      </button>
    </div>
  </aside>
</template>
