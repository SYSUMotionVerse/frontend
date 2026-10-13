<script setup lang="ts">
import { getCurrentInstance, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import SignatureSheet from '../../../components/access/SignatureSheet.vue'
import { studentBackendSync } from '../../api/studentBackend'
import { formatBackendErrorMessage } from '../../api/reportBackendSyncError'
import type { StudyConsentDocument, ConsentField, ConsentSignatureResult, ConsentSignatureInput } from '../../api/consentTypes'
import { recognizeSignatureWithVisionKit, normalizeSignatureName, type SignaturePixels } from '../../platform/signatureOcr'
import { consentFieldStyle } from '../../platform/consentLayout'

const document = shallowRef<StudyConsentDocument | null>(null)
const signature = shallowRef<ConsentSignatureResult | null>(null)
const sheetOpen = shallowRef(false)
const busy = shallowRef(false)
const loading = shallowRef(true)
const error = shallowRef('')
const signatureError = shallowRef('')
const agreed = shallowRef(false)
let pendingUpload: ConsentSignatureInput | null = null
let active = true
const instance = getCurrentInstance()?.proxy
const pageWidths = shallowRef<Record<number, number>>({})

function fieldText(name: string, field: ConsentField) {
  if (name === 'participant') return '点击进行电子签名'
  if (name === 'researcher') return document.value?.researcher_name ?? ''
  return `${field.value_only ? '' : '日期：'}${document.value?.date ?? ''}`
}
function fieldStyle(field: ConsentField, index: number, name: string) {
  const page = document.value!.pages[index]
  const screenWidth = typeof uni.getSystemInfoSync === 'function' ? uni.getSystemInfoSync().windowWidth : 375
  const width = pageWidths.value[index] ?? screenWidth * 654 / 750
  return consentFieldStyle(field, width, width * page.height / page.width, fieldText(name, field))
}
function measurePage(index: number) {
  if (typeof uni.createSelectorQuery !== 'function') return
  uni.createSelectorQuery().in(instance).select(`#consent-page-${index}`).boundingClientRect(rect => {
    const width = (rect as UniApp.NodeInfo | null)?.width
    if (active && width && width > 0) pageWidths.value = { ...pageWidths.value, [index]: width }
  }).exec()
}
function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, key => {
    const random = Math.floor(Math.random() * 16)
    return (key === 'x' ? random : (random & 3) | 8).toString(16)
  })
}
async function load() {
  loading.value = true
  error.value = ''
  signature.value = null
  agreed.value = false
  pendingUpload = null
  try {
    document.value = await studentBackendSync.loadStudyConsent()
    if (!active) return
    if (!document.value.participant_name.trim()) { await goNext(); return }
    if (!document.value.required) await goNext()
  } catch (cause) { error.value = formatBackendErrorMessage(cause, '同意书暂时无法加载，请重试。') }
  finally { loading.value = false }
}
async function upload(value: { imageBase64: string, pixels: SignaturePixels }) {
  if (busy.value || !document.value) return
  busy.value = true
  signatureError.value = ''
  try {
    let text = ''
    let recognitionError = ''
    try { text = await recognizeSignatureWithVisionKit(value.pixels) }
    catch (cause) { recognitionError = cause instanceof Error ? cause.message : '微信 OCR 识别失败，请重新签名。' }
    if (!active) return
    const matched = !recognitionError && normalizeSignatureName(text) === normalizeSignatureName(document.value.participant_name)
    if (!pendingUpload || pendingUpload.image_base64 !== value.imageBase64) {
      pendingUpload = { template_id: document.value.template_id, client_request_id: requestId(), image_base64: value.imageBase64,
        client_recognition: { method: 'wechat-visionkit', text, error: recognitionError } }
    }
    const result = await studentBackendSync.uploadConsentSignature(pendingUpload)
    if (!active) return
    if (!matched || (result.status !== 'VERIFIED' && result.status !== 'ACCEPTED')) {
      signature.value = null
      signatureError.value = recognitionError || result.error || '未能识别完整姓名，请用清晰楷体重新签名。'
      pendingUpload = null
      return
    }
    signature.value = result
    sheetOpen.value = false
    pendingUpload = null
  } catch (cause) { signatureError.value = formatBackendErrorMessage(cause, '识别或上传失败，请重试。') }
  finally { busy.value = false }
}
async function goNext() {
  const result = await studentBackendSync.bootstrapAccess()
  if (!active) return
  await uni.reLaunch({ url: result.targetPageUrl })
}
async function confirm() {
  if (!agreed.value || !signature.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await studentBackendSync.acceptStudyConsent(signature.value.id)
    await goNext()
  } catch (cause) { error.value = formatBackendErrorMessage(cause, '签署确认失败，请重试。') }
  finally { busy.value = false }
}
function preview(index: number) {
  if (document.value) void uni.previewImage({ current: document.value.pages[index].url, urls: document.value.pages.map(page => page.url) })
}
onMounted(() => { void load() })
onBeforeUnmount(() => { active = false })
</script>

<template>
  <UniAccessPageShell navigation-title="知情同意书" title="请阅读受试者知情同意书" :show-back="false" compact-title>
    <view v-if="loading" class="consent-status">正在加载同意书…</view>
    <template v-if="document">
      <text class="consent-hint">请完整阅读，文档可点击放大。参加研究完全自愿，如有疑问请联系研究人员。</text>
      <view v-for="(page, index) in document.pages" :id="`consent-page-${index}`" :key="index" class="consent-document-page" :style="{ aspectRatio: `${page.width} / ${page.height}` }">
        <image class="consent-document-image" :src="page.url" mode="widthFix" @load="measurePage(index)" @click="preview(index)" />
        <template v-for="(field, name) in document.layout" :key="name">
          <view v-if="field.page === index" class="consent-document-field" :class="{ 'consent-document-field--signature': name === 'participant' }" :style="fieldStyle(field, index, name)" @click="name === 'participant' && (sheetOpen = true)">
            <template v-if="name === 'participant'"><image v-if="signature" :src="signature.image_url" mode="aspectFit" class="consent-signed-image" /><text v-else>点击进行电子签名</text></template>
            <text v-else>{{ fieldText(name, field) }}</text>
          </view>
        </template>
      </view>
      <checkbox-group @change="agreed = $event.detail.value.includes('agree')"><label class="consent-agreement"><checkbox value="agree" :checked="agreed" color="#ff8580" /><text>本人已完整阅读并理解知情同意书，自愿同意参加研究。</text></label></checkbox-group>
      <button class="btn-primary consent-confirm" :disabled="!agreed || !signature || busy" @click="confirm">{{ busy ? '正在保存签署…' : '确认签署并继续' }}</button>
    </template>
    <view v-if="error" class="consent-error">{{ error }}<button :disabled="busy" @click="load">重新加载同意书</button></view>
    <SignatureSheet :visible="sheetOpen" :name="document?.participant_name ?? ''" :busy="busy" :error="signatureError" @close="sheetOpen = false" @complete="upload" />
  </UniAccessPageShell>
</template>

<style scoped>
.consent-hint{display:block;color:#667584;font-size:27rpx;line-height:1.7;margin-bottom:24rpx}.consent-document-page{position:relative;width:100%;margin-bottom:20rpx;background:#fff;border-radius:16rpx;overflow:hidden}.consent-document-image{display:block;width:100%;height:auto}.consent-document-field{position:absolute;display:flex;align-items:center;background:#fff;color:#203344;line-height:1;white-space:nowrap;overflow:hidden;box-sizing:border-box}.consent-document-field--signature{border:2rpx dashed #ce8b7d;justify-content:center;color:#a65b51}.consent-signed-image{width:100%;height:100%}.consent-agreement{display:flex;align-items:flex-start;gap:12rpx;font-size:27rpx;line-height:1.6;color:#526270;margin:28rpx 0}.consent-confirm{margin-top:20rpx}.consent-error{color:#a4473b;font-size:27rpx;margin-top:24rpx}.consent-status{color:#667584;padding:30rpx}
</style>
