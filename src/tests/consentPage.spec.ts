import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  loadStudyConsent: vi.fn(), uploadConsentSignature: vi.fn(), acceptStudyConsent: vi.fn(), bootstrapAccess: vi.fn()
}))
const ocr = vi.hoisted(() => vi.fn())
vi.mock('../uni-app/api/studentBackend', () => ({ studentBackendSync: backend }))
vi.mock('../uni-app/platform/signatureOcr', async importOriginal => ({
  ...await importOriginal<typeof import('../uni-app/platform/signatureOcr')>(), recognizeSignatureWithVisionKit: ocr
}))

describe('informed consent page', () => {
  beforeEach(() => {
    ocr.mockReset()
    ocr.mockResolvedValue('李芳滨')
    backend.uploadConsentSignature.mockClear()
    vi.stubGlobal('uni', { reLaunch: vi.fn().mockResolvedValue(undefined), previewImage: vi.fn() })
    const field = { page: 0, x: .1, y: .7, width: .3, height: .05 }
    backend.loadStudyConsent.mockResolvedValue({ template_id: 1, title: '知情同意书', required: true,
      participant_name: '李芳滨', researcher_name: '李芳滨', date: '2026年10月13日',
      pages: [{ url: 'https://private.example/page', width: 600, height: 800 }],
      layout: { participant: field, researcher: field, participant_date: field, researcher_date: field } })
    backend.uploadConsentSignature.mockResolvedValue({ id: 'verified', status: 'VERIFIED', image_url: 'https://private.example/signature', error: '' })
    backend.acceptStudyConsent.mockReset()
    backend.acceptStudyConsent.mockResolvedValue({ status: 'ACCEPTED' })
    backend.bootstrapAccess.mockResolvedValue({ targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline' })
  })
  async function page() {
    const ConsentPage = (await import('../uni-app/pages/access/consent.vue')).default
    const wrapper = mount(ConsentPage, { global: { stubs: {
      UniAccessPageShell: { template: '<div><slot /></div>' },
      SignatureSheet: { name: 'SignatureSheet', props: ['visible', 'error', 'busy'], template: '<div class="sheet">{{ error }}</div>' }
    } } })
    await flushPromises()
    return wrapper
  }
  it('shows document fields and requires a signature plus voluntary agreement', async () => {
    const wrapper = await page()
    expect(wrapper.text()).toContain('点击进行电子签名')
    expect(wrapper.text()).toContain('李芳滨')
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
    await wrapper.get('.consent-confirm').trigger('click')
    expect(backend.acceptStudyConsent).not.toHaveBeenCalled()
  })
  it('fills only the original date blank and recomputes typography from the measured image width', async () => {
    const document = await backend.loadStudyConsent()
    document.layout = Object.fromEntries(Object.entries(document.layout).map(([name, field]) => [name, {
      ...(field as object), value_only: true, font_size: .02
    }]))
    backend.loadStudyConsent.mockResolvedValue(document)
    vi.stubGlobal('uni', { getSystemInfoSync: () => ({ windowWidth: 375 }),
      createSelectorQuery: () => ({ in() { return this }, select() { return this },
        boundingClientRect(callback: (rect: { width: number }) => void) { callback({ width: 250 }); return this }, exec() {} }) })
    const wrapper = await page()
    const field = wrapper.get('.consent-document-field').element as HTMLElement
    const before = parseFloat(field.style.fontSize)
    await wrapper.get('.consent-document-image').trigger('load')
    await flushPromises()
    expect(parseFloat(field.style.fontSize)).toBeLessThan(before)
    expect(wrapper.text()).not.toContain('日期：')
    expect(wrapper.text().match(/2026年10月13日/g)).toHaveLength(2)
  })
  it('asks for a new signature after OCR rejection and never confirms the rejected attempt', async () => {
    backend.uploadConsentSignature.mockResolvedValue({ id: 'bad', status: 'REJECTED', error: '请重新签名' })
    const wrapper = await page()
    wrapper.findComponent({ name: 'SignatureSheet' }).vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(), width: 1, height: 1 } })
    await flushPromises()
    expect(wrapper.text()).toContain('请重新签名')
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
    expect(backend.acceptStudyConsent).not.toHaveBeenCalled()
  })
  it('only confirms the verified attempt after agreement and then routes using backend progress', async () => {
    const wrapper = await page()
    wrapper.findComponent({ name: 'SignatureSheet' }).vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(), width: 1, height: 1 } })
    await flushPromises()
    wrapper.get('checkbox-group').element.dispatchEvent(new CustomEvent('change', { detail: { value: ['agree'] } }))
    await flushPromises()
    await wrapper.get('.consent-confirm').trigger('click')
    await flushPromises()
    expect(backend.acceptStudyConsent).toHaveBeenCalledWith('verified')
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/access/questionnaire?checkpoint=baseline' })
  })
  it('archives the attempt and asks for an update when native OCR is unavailable', async () => {
    ocr.mockRejectedValue(new Error('当前微信不支持签名识别，请更新微信后重新签名。'))
    backend.uploadConsentSignature.mockResolvedValue({ id: 'bad', status: 'REJECTED', error: '需重签' })
    const wrapper = await page()
    wrapper.findComponent({ name: 'SignatureSheet' }).vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(), width: 1, height: 1 } })
    await flushPromises()
    expect(backend.uploadConsentSignature).toHaveBeenCalledWith(expect.objectContaining({
      image_base64: 'png', client_recognition: { method: 'wechat-visionkit', text: '', error: '当前微信不支持签名识别，请更新微信后重新签名。' }
    }))
    expect(wrapper.text()).toContain('更新微信')
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
  })
})
