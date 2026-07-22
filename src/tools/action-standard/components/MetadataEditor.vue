<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'
import type { ActionType, ActionVideoItem, TtsCue } from '../types'

const props = defineProps<{ item: ActionVideoItem }>()
const emit = defineEmits<{
  patch: [patch: Partial<ActionVideoItem>]
}>()

function valueFrom(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function patchCue(index: number, patch: Partial<TtsCue>) {
  emit('patch', {
    ttsCues: props.item.ttsCues.map((cue, cueIndex) => cueIndex === index ? { ...cue, ...patch } : cue)
  })
}

function removeCue(index: number) {
  emit('patch', { ttsCues: props.item.ttsCues.filter((_, cueIndex) => cueIndex !== index) })
}

function addCue() {
  emit('patch', { ttsCues: [...props.item.ttsCues, { time: props.item.trimStart, text: '' }] })
}
</script>

<template>
  <section class="editor-panel" aria-labelledby="annotation-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">动作标注</p>
        <h2 id="annotation-title">文件信息</h2>
      </div>
    </div>

    <div class="form-grid">
      <label class="field field--wide">
        <span>动作名称</span>
        <input :value="item.actionName" @input="emit('patch', { actionName: valueFrom($event) })" />
      </label>
      <label class="field field--wide">
        <span>动作 ID</span>
        <input :value="item.actionId" @input="emit('patch', { actionId: valueFrom($event) })" />
      </label>
      <label class="field">
        <span>动作类型</span>
        <select :value="item.actionType" @change="emit('patch', { actionType: valueFrom($event) as ActionType })">
          <option value="repetitive">重复动作</option>
          <option value="hold">保持动作</option>
          <option value="single">单次动作</option>
        </select>
      </label>
      <label class="field">
        <span>标注人</span>
        <input :value="item.createdBy" placeholder="姓名或账号" @input="emit('patch', { createdBy: valueFrom($event) })" />
      </label>
      <label class="field">
        <span>开始时间（秒）</span>
        <input
          type="number"
          min="0"
          step="0.1"
          :max="item.trimEnd"
          :value="item.trimStart"
          @input="emit('patch', { trimStart: Number(valueFrom($event)) })"
        />
      </label>
      <label class="field">
        <span>结束时间（秒）</span>
        <input
          type="number"
          :min="item.trimStart"
          step="0.1"
          :max="item.duration"
          :value="item.trimEnd"
          @input="emit('patch', { trimEnd: Number(valueFrom($event)) })"
        />
      </label>
      <label class="field field--wide">
        <span>备注</span>
        <textarea :value="item.note" rows="2" @input="emit('patch', { note: valueFrom($event) })" />
      </label>
    </div>

    <div class="cue-heading">
      <div>
        <h3>语音提示</h3>
        <span>按视频时间触发</span>
      </div>
      <button class="text-button" type="button" @click="addCue">
        <Plus :size="16" aria-hidden="true" />
        添加
      </button>
    </div>

    <div v-if="item.ttsCues.length" class="cue-list">
      <div v-for="(cue, index) in item.ttsCues" :key="index" class="cue-row">
        <label class="field cue-time">
          <span class="sr-only">提示时间</span>
          <input type="number" min="0" step="0.1" :value="cue.time" @input="patchCue(index, { time: Number(valueFrom($event)) })" />
        </label>
        <label class="field cue-text">
          <span class="sr-only">提示内容</span>
          <input :value="cue.text" placeholder="输入语音提示" @input="patchCue(index, { text: valueFrom($event) })" />
        </label>
        <button class="icon-button icon-button--quiet" type="button" title="删除提示" @click="removeCue(index)">
          <Trash2 :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <p v-else class="empty-cues">没有语音提示</p>
  </section>
</template>
