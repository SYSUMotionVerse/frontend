<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import SignatureSheet from '../../../components/access/SignatureSheet.vue'
import { studentBackendSync } from '../../api/studentBackend'
import { formatBackendErrorMessage } from '../../api/reportBackendSyncError'
import { BackendRequestError } from '../../api/backendClient'
import type { StudyConsentDocument, ConsentField, ConsentSignatureInput } from '../../api/consentTypes'
import { createSignatureRecognizer, normalizeSignatureName, type SignaturePixels } from '../../platform/signatureOcr'
import { consentFieldStyle } from '../../platform/consentLayout'
import { signatureOperation } from '../../platform/signatureOperation'
import { yieldSignatureUi, cropSignatureImage, type SignatureDraft } from '../../platform/signatureImage'
import { SIGNATURE_REWRITE_MESSAGE } from '../../platform/signaturePresentation'

const document = shallowRef<StudyConsentDocument | null>(null)
interface SavedSignature { imageBase64: string, imageUrl: string, aspect: number, text: string, draft: SignatureDraft }
const signature = shallowRef<SavedSignature | null>(null)
const sheetOpen = shallowRef(false)
const busy = shallowRef(false)
const loading = shallowRef(true)
const error = shallowRef('')
const signatureError = shallowRef('')
const signatureDraft = shallowRef<SignatureDraft | null>(null)
const recognizer = createSignatureRecognizer()
const agreed = shallowRef(false)
let pendingUpload: ConsentSignatureInput | null = null
let active = true
let uploadAttempt = 0
let cancelRecognition: (() => void) | undefined
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
  return consentFieldStyle(field, width, width * page.height / page.width, fieldText(name, field), name, document.value!.layout,
    name === 'participant' ? signature.value?.aspect : undefined)
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
  signatureDraft.value = null
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
function cloneDraft(draft: SignatureDraft | null) {
  return draft ? { width: draft.width, height: draft.height,
    strokes: draft.strokes.map(stroke => stroke.map(segment => [...segment] as typeof segment)) } : null
}
async function verifySignature(value: { imageBase64: string, pixels: SignaturePixels }) {
  if (busy.value || !document.value) return
  const draft = cloneDraft(signatureDraft.value)
  if (!draft) return
  busy.value = true
  const attempt = ++uploadAttempt
  const current = () => active && uploadAttempt === attempt
  signatureError.value = ''
  try {
    await nextTick()
    await yieldSignatureUi()
    if (!current()) return
    let text = ''
    try { text = await signatureOperation<string>((resolve, reject) => {
      recognizer.recognize(value.pixels, cancel => {
        if (current()) cancelRecognition = cancel
        else cancel()
      }).then(resolve, reject)
    }, 'signature_recognition_deadline', 30000) }
    catch {
      cancelRecognition?.()
      cancelRecognition = undefined
      throw new Error('signature_verification_failed')
    }
    if (!current()) return
    if (normalizeSignatureName(text) !== normalizeSignatureName(document.value.participant_name)) throw new Error('signature_name_mismatch')
    const cropped = cropSignatureImage(value.pixels)
    signature.value = { ...cropped, imageUrl: `data:image/png;base64,${cropped.imageBase64}`, text, draft }
    sheetOpen.value = false
    pendingUpload = null
  } catch { if (current()) signatureError.value = SIGNATURE_REWRITE_MESSAGE }
  finally { if (current()) { cancelRecognition = undefined; busy.value = false } }
}
function closeSignature() {
  uploadAttempt++
  cancelRecognition?.()
  cancelRecognition = undefined
  sheetOpen.value = false
  busy.value = false
  signatureDraft.value = cloneDraft(signature.value?.draft ?? null)
}
function openSignature() {
  if (busy.value) return
  signatureError.value = ''
  signatureDraft.value = cloneDraft(signature.value?.draft ?? null)
  // Static-image mode needs no camera stream. Start while the user writes,
  // then reuse the session for subsequent completed signatures on this page.
  void recognizer.prepare().catch(() => {})
  sheetOpen.value = true
}
function updateSignatureDraft(draft: SignatureDraft) {
  signatureDraft.value = draft
  signatureError.value = ''
  if (sheetOpen.value && !busy.value && !draft.strokes.length) void recognizer.prepare().catch(() => {})
}
async function goNext() {
  const result = await studentBackendSync.bootstrapAccess()
  if (!active) return
  await uni.reLaunch({ url: result.targetPageUrl })
}
async function confirm() {
  if (!agreed.value || !signature.value || !document.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (!pendingUpload) pendingUpload = { template_id: document.value.template_id, client_request_id: requestId(),
      image_base64: signature.value.imageBase64, client_recognition: { method: 'wechat-visionkit', text: signature.value.text }, agree: true }
    const submitted = await studentBackendSync.submitStudyConsent(pendingUpload)
    if (submitted.status !== 'ACCEPTED') throw new Error('signature_not_submitted')
    await goNext()
  } catch (cause) {
    const status = cause instanceof BackendRequestError ? cause.statusCode : undefined
    console.warn('[consent-signature] submission_failed', {
      statusCode: status, requestId: cause instanceof BackendRequestError ? cause.requestId : undefined,
      stage: 'formal_submission'
    })
    const message = status === 400
      ? formatBackendErrorMessage(cause, '提交未完成，请检查同意书和签名后再试。')
      : '提交暂未完成，已保留您的签名，请稍后再次点击“确认签署并继续”。'
    const requestId = cause instanceof BackendRequestError ? cause.requestId : ''
    error.value = status === 400 ? message : `${message}${requestId ? `（请求编号：${requestId}）` : ''}`
  }
  finally { busy.value = false }
}
function preview(index: number) {
  if (document.value) void uni.previewImage({ current: document.value.pages[index].url, urls: document.value.pages.map(page => page.url) })
}
onMounted(() => { void load() })
onBeforeUnmount(() => { active = false; recognizer.dispose(); cancelRecognition = undefined })
</script>

<template>
  <UniAccessPageShell navigation-title="知情同意书" title="请阅读受试者知情同意书" :show-back="false" compact-title>
    <view v-if="loading" class="consent-status">正在加载同意书…</view>
    <template v-if="document">
      <text class="consent-hint">请完整阅读，文档可点击放大。参加研究完全自愿，如有疑问请联系研究人员。</text>
      <view v-for="(page, index) in document.pages" :id="`consent-page-${index}`" :key="index" class="consent-document-page" :style="{ aspectRatio: `${page.width} / ${page.height}` }">
        <image class="consent-document-image" :src="page.url" mode="widthFix" @load="measurePage(index)" @click="preview(index)" />
        <template v-for="(field, name) in document.layout" :key="name">
          <view v-if="field.page === index" class="consent-document-field" :class="{ 'consent-document-field--signature': name === 'participant' }" :style="fieldStyle(field, index, name)" @click="name === 'participant' && openSignature()">
            <template v-if="name === 'participant'"><image v-if="signature" :src="signature.imageUrl" mode="aspectFit" class="consent-signed-image" /><text v-else>点击进行电子签名</text></template>
            <text v-else>{{ fieldText(name, field) }}</text>
          </view>
        </template>
      </view>
      <checkbox-group @change="agreed = $event.detail.value.includes('agree')"><label class="consent-agreement"><checkbox value="agree" :checked="agreed" color="#ff8580" /><text>本人已完整阅读并理解知情同意书，自愿同意参加研究。</text></label></checkbox-group>
      <button class="btn-primary consent-confirm" :disabled="!agreed || !signature || busy" @click="confirm">{{ busy ? '处理中…' : '确认签署并继续' }}</button>
    </template>
    <view v-if="error" class="consent-error">{{ error }}<button :disabled="busy" @click="load">重新加载同意书</button></view>
  </UniAccessPageShell>
  <SignatureSheet :visible="sheetOpen" :name="document?.participant_name ?? ''" :busy="busy" :error="signatureError" :draft="signatureDraft" @change="updateSignatureDraft" @close="closeSignature" @complete="verifySignature" />
</template>

<style scoped>
.consent-hint{display:block;color:#667584;font-size:27rpx;line-height:1.7;margin-bottom:24rpx}.consent-document-page{position:relative;width:100%;margin-bottom:20rpx;background:#fff;border-radius:16rpx;overflow:hidden}.consent-document-image{display:block;width:100%;height:auto}.consent-document-field{position:absolute;display:flex;align-items:center;background:#fff;color:#203344;line-height:1.4;white-space:nowrap;overflow:hidden;box-sizing:border-box}.consent-document-field text{display:block;font-size:inherit;line-height:1.4;white-space:nowrap}.consent-document-field--signature{border:1px dashed #ce8b7d;padding:2px;justify-content:center;color:#a65b51}.consent-signed-image{width:100%;height:100%}.consent-agreement{display:flex;align-items:flex-start;gap:12rpx;font-size:27rpx;line-height:1.6;color:#526270;margin:28rpx 0}.consent-confirm{margin-top:20rpx}.consent-error{color:#a4473b;font-size:27rpx;margin-top:24rpx}.consent-status{color:#667584;padding:30rpx}
</style>
