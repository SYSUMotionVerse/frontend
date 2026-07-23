<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Archive, Download, LoaderCircle, Play, Upload } from '@lucide/vue'
import { strToU8, zipSync } from 'fflate'
import { buildActionExportFile, createUniqueJsonFilenames } from './actionExport'
import MetadataEditor from './components/MetadataEditor.vue'
import VideoQueue from './components/VideoQueue.vue'
import VideoWorkspace from './components/VideoWorkspace.vue'
import { analyzeVideo, preparePoseDetector } from './videoAnalyzer'
import type { ActionVideoItem } from './types'

const items = ref<ActionVideoItem[]>([])
const selectedId = ref('')
const exportedBy = ref('')
const modelState = ref<'loading' | 'ready' | 'error'>('loading')
const running = ref(false)
let controller: AbortController | null = null

preparePoseDetector()
  .then(() => { modelState.value = 'ready' })
  .catch(() => { modelState.value = 'error' })

const selectedItem = computed(() => items.value.find(item => item.id === selectedId.value) ?? null)
const readyItems = computed(() => items.value.filter(item => item.status === 'ready' && item.output))
const pendingCount = computed(() => items.value.filter(item => item.status !== 'ready').length)

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '')
}

function readDuration(objectUrl: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(video.duration)
    video.onerror = () => reject(new Error('无法读取视频时长'))
    video.src = objectUrl
  })
}

async function addFiles(files: File[]) {
  for (const file of files.filter(file => file.type.startsWith('video/'))) {
    const objectUrl = URL.createObjectURL(file)
    try {
      const duration = await readDuration(objectUrl)
      const name = stripExtension(file.name)
      const item: ActionVideoItem = {
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        objectUrl,
        duration,
        actionName: name,
        note: '',
        status: 'pending',
        progress: 0,
        detectedFrames: 0,
        totalFrames: Math.max(1, Math.ceil(duration * 30)),
        error: '',
        output: null
      }
      items.value.push(item)
      selectedId.value ||= item.id
    } catch {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

function removeItem(id: string) {
  const item = items.value.find(entry => entry.id === id)
  if (item?.status === 'analyzing') return
  if (item) URL.revokeObjectURL(item.objectUrl)
  items.value = items.value.filter(entry => entry.id !== id)
  if (selectedId.value === id) selectedId.value = items.value[0]?.id ?? ''
}

function patchSelected(patch: Partial<ActionVideoItem>) {
  if (!selectedItem.value) return
  Object.assign(selectedItem.value, patch, { output: null, status: 'pending', error: '' })
}

function validateItem(item: ActionVideoItem) {
  if (!item.actionName.trim()) return '请填写动作名称'
  return ''
}

async function processItem(item: ActionVideoItem, signal: AbortSignal) {
  const validationError = validateItem(item)
  if (validationError) {
    item.status = 'error'
    item.error = validationError
    return
  }
  item.status = 'analyzing'
  item.error = ''
  item.progress = 0
  selectedId.value = item.id
  try {
    const { samples, sourceFps } = await analyzeVideo({
      objectUrl: item.objectUrl,
      start: 0,
      end: item.duration,
      signal,
      onProgress(completed, total, detected) {
        item.progress = Math.round(completed / total * 100)
        item.totalFrames = total
        item.detectedFrames = detected
      }
    })
    item.output = buildActionExportFile(item, samples, {
      exportedBy: exportedBy.value,
      sourceFps
    })
    item.status = 'ready'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      item.status = 'pending'
      item.error = ''
      return
    }
    item.status = 'error'
    item.error = error instanceof Error ? error.message : '视频分析失败'
  }
}

async function run(itemsToRun: ActionVideoItem[]) {
  if (running.value || modelState.value !== 'ready') return
  running.value = true
  controller = new AbortController()
  for (const item of itemsToRun) {
    if (controller.signal.aborted) break
    await processItem(item, controller.signal)
  }
  controller = null
  running.value = false
}

function cancel() {
  controller?.abort()
}

function exportZip() {
  const exportedAt = new Date().toISOString()
  const filenames = createUniqueJsonFilenames(readyItems.value.map(item => item.actionName))
  const files = Object.fromEntries(readyItems.value.map((item, index) => {
    const output = {
      ...item.output!,
      metadata: {
        ...item.output!.metadata,
        exported_by: exportedBy.value.trim(),
        exported_at: exportedAt
      }
    }
    return [filenames[index], strToU8(JSON.stringify(output, null, 2))]
  }))
  const archive = zipSync(files, { level: 6 })
  const blob = new Blob([new Uint8Array(archive)], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `action-export-${new Date().toISOString().slice(0, 10)}.zip`
  anchor.click()
  URL.revokeObjectURL(url)
}

function dropFiles(event: DragEvent) {
  addFiles(Array.from(event.dataTransfer?.files ?? []))
}

function importFiles(event: Event) {
  addFiles(Array.from((event.target as HTMLInputElement).files ?? []))
  ;(event.target as HTMLInputElement).value = ''
}

onBeforeUnmount(() => {
  cancel()
  items.value.forEach(item => URL.revokeObjectURL(item.objectUrl))
})
</script>

<template>
  <main class="app-shell" @dragover.prevent @drop.prevent="dropFiles">
    <header class="topbar">
      <div class="brand-lockup">
        <span class="brand-mark"><Archive :size="20" aria-hidden="true" /></span>
        <div>
          <h1>动作原始数据工作台</h1>
          <p>逐帧姿态分析与 action_export 导出</p>
        </div>
      </div>
      <div class="topbar-actions">
        <span class="model-status" :class="`model-status--${modelState}`">
          <LoaderCircle v-if="modelState === 'loading'" class="spin" :size="14" aria-hidden="true" />
          {{ modelState === 'ready' ? '姿态模型就绪' : modelState === 'error' ? '模型加载失败' : '正在加载模型' }}
        </span>
        <label class="exported-by-field">
          <span>统一导出人</span>
          <input v-model="exportedBy" placeholder="姓名或账号" aria-label="统一导出人" />
        </label>
        <label class="secondary-button secondary-button--compact">
          <Upload :size="17" aria-hidden="true" />
          导入视频
          <input class="sr-only" type="file" accept="video/*" multiple @change="importFiles" />
        </label>
        <button
          class="primary-button primary-button--compact"
          type="button"
          :disabled="readyItems.length === 0"
          @click="exportZip"
        >
          <Download :size="17" aria-hidden="true" />
          导出 {{ readyItems.length }} 个文件
        </button>
      </div>
    </header>

    <div class="workbench">
      <VideoQueue
        :items="items"
        :selected-id="selectedId"
        @add="addFiles"
        @remove="removeItem"
        @select="selectedId = $event"
      />

      <div v-if="selectedItem" class="workspace-grid">
        <VideoWorkspace
          :item="selectedItem"
          :busy="selectedItem.status === 'analyzing'"
          @analyze="run([selectedItem])"
          @cancel="cancel"
        />
        <MetadataEditor :item="selectedItem" @patch="patchSelected" />
      </div>

      <section v-else class="welcome-panel">
        <span class="welcome-icon"><Upload :size="28" aria-hidden="true" /></span>
        <h2>导入动作视频</h2>
        <p>文件只在本机浏览器中处理，不会上传到服务器。</p>
        <label class="primary-button primary-button--compact">
          <Upload :size="17" aria-hidden="true" />
          选择视频
          <input class="sr-only" type="file" accept="video/*" multiple @change="importFiles" />
        </label>
      </section>
    </div>

    <footer v-if="items.length" class="batch-bar">
      <div>
        <strong>{{ readyItems.length }} / {{ items.length }} 已生成</strong>
        <span>每个视频会导出一个 schema 0.5 action_export JSON</span>
      </div>
      <button
        v-if="running"
        class="secondary-button secondary-button--compact"
        type="button"
        @click="cancel"
      >
        取消批量分析
      </button>
      <button
        v-else
        class="primary-button primary-button--compact"
        type="button"
        :disabled="pendingCount === 0 || modelState !== 'ready'"
        @click="run(items.filter(item => item.status !== 'ready'))"
      >
        <Play :size="17" fill="currentColor" aria-hidden="true" />
        分析剩余 {{ pendingCount }} 个视频
      </button>
    </footer>
  </main>
</template>
