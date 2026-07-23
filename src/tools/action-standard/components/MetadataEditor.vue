<script setup lang="ts">
import type { ActionVideoItem } from '../types'

const props = defineProps<{ item: ActionVideoItem }>()
const emit = defineEmits<{
  patch: [patch: Partial<ActionVideoItem>]
}>()

function valueFrom(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

</script>

<template>
  <section class="editor-panel" aria-labelledby="annotation-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">导出信息</p>
        <h2 id="annotation-title">文件信息</h2>
      </div>
    </div>

    <div class="form-grid">
      <label class="field field--wide">
        <span>动作名称</span>
        <input :value="item.actionName" @input="emit('patch', { actionName: valueFrom($event) })" />
      </label>
      <label class="field field--wide">
        <span>备注</span>
        <textarea :value="item.note" rows="2" @input="emit('patch', { note: valueFrom($event) })" />
      </label>
    </div>
  </section>
</template>
