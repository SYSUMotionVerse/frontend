<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef } from 'vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import SignatureSheet from '../../../components/access/SignatureSheet.vue'
import { studentBackendSync } from '../../api/studentBackend'
import { formatBackendErrorMessage } from '../../api/reportBackendSyncError'
import type { StudyConsentDocument, ConsentField, ConsentSignatureResult, ConsentSignatureInput } from '../../api/consentTypes'
import { recognizeSignatureWithVisionKit, type SignaturePixels } from '../../platform/signatureOcr'

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

function fieldStyle(field: ConsentField) {
  return { left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%` }
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
    const text = await recognizeSignatureWithVisionKit(value.pixels).catch(() => '')
    if (!pendingUpload || pendingUpload.image_base64 !== value.imageBase64) {
      pendingUpload = { template_id: document.value.template_id, client_request_id: requestId(), image_base64: value.imageBase64,
        client_recognition: { method: text ? 'wechat-visionkit' : 'server-fallback', text } }
    }
    const result = await studentBackendSync.uploadConsentSignature(pendingUpload)
    if (!active) return
    if (result.status !== 'VERIFIED' && result.status !== 'ACCEPTED') {
      signature.value = null
      signatureError.value = result.error || '未能识别完整姓名，请用清晰楷体重新签名。'
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
      <view v-for="(page, index) in document.pages" :key="index" class="consent-document-page" :style="{ aspectRatio: `${page.width} / ${page.height}` }">
        <image class="consent-document-image" :src="page.url" mode="widthFix" @click="preview(index)" />
        <template v-for="(field, name) in document.layout" :key="name">
          <view v-if="field.page === index" class="consent-document-field" :class="{ 'consent-document-field--signature': name === 'participant' }" :style="fieldStyle(field)" @click="name === 'participant' && (sheetOpen = true)">
            <template v-if="name === 'participant'"><image v-if="signature" :src="signature.image_url" mode="aspectFit" class="consent-signed-image" /><text v-else>点击进行电子签名</text></template>
            <text v-else-if="name === 'researcher'">{{ document.researcher_name }}</text>
            <text v-else>日期：{{ document.date }}</text>
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
.consent-hint{display:block;color:#667584;font-size:27rpx;line-height:1.7;margin-bottom:24rpx}.consent-document-page{position:relative;width:100%;margin-bottom:20rpx;background:#fff;border-radius:16rpx;overflow:hidden}.consent-document-image{display:block;width:100%;height:auto}.consent-document-field{position:absolute;display:flex;align-items:center;background:#fff;color:#203344;font-size:19rpx;overflow:hidden;box-sizing:border-box}.consent-document-field--signature{border:2rpx dashed #ce8b7d;justify-content:center;color:#a65b51;font-size:19rpx}.consent-signed-image{width:100%;height:100%}.consent-agreement{display:flex;align-items:flex-start;gap:12rpx;font-size:27rpx;line-height:1.6;color:#526270;margin:28rpx 0}.consent-confirm{margin-top:20rpx}.consent-error{color:#a4473b;font-size:27rpx;margin-top:24rpx}.consent-status{color:#667584;padding:30rpx}
</style>
