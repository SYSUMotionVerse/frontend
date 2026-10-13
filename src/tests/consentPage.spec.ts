import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendRequestError } from '../uni-app/api/backendClient'
const backend = vi.hoisted(() => ({ loadStudyConsent: vi.fn(), submitStudyConsent: vi.fn(), bootstrapAccess: vi.fn() }))
const recognizer = vi.hoisted(() => ({ prepare: vi.fn(), recognize: vi.fn(), dispose: vi.fn() }))
vi.mock('../uni-app/api/studentBackend', () => ({ studentBackendSync: backend }))
vi.mock('../uni-app/platform/signatureOcr', async original => ({ ...await original<typeof import('../uni-app/platform/signatureOcr')>(), createSignatureRecognizer: () => recognizer }))
const draft = (x = 20) => ({ width: 319, height: 190, strokes: [[[x, 30, x + 30, 50] as const]] })
const image = () => {
  const data = new Uint8ClampedArray(64 * 32 * 4).fill(255)
  for (let y = 8; y < 24; y++) for (let x = 10; x < 40; x++) data.set([32, 51, 68, 255], (y * 64 + x) * 4)
  return { imageBase64: 'full-image', pixels: { data, width: 64, height: 32 } }
}
async function settle() { await flushPromises(); await vi.advanceTimersByTimeAsync(5); await flushPromises() }

describe('local verified signatures and formal consent submission', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recognizer.recognize.mockReset().mockResolvedValue('李芳滨')
    recognizer.prepare.mockReset().mockResolvedValue(undefined)
    recognizer.dispose.mockReset()
    backend.submitStudyConsent.mockReset().mockResolvedValue({ id: 'formal', status: 'ACCEPTED' })
    backend.bootstrapAccess.mockReset().mockResolvedValue({ targetPageUrl: '/pages/access/questionnaire?checkpoint=baseline' })
    const field = { page: 0, x: .24, y: .7, width: .16, height: .014, value_only: true, font_size: .02 }
    backend.loadStudyConsent.mockReset().mockResolvedValue({ template_id: 1, title: '知情同意书', required: true,
      participant_name: '李芳滨', researcher_name: '李芳滨', date: '2026年10月13日',
      pages: [{ url: 'https://private.example/page', width: 600, height: 800 }],
      layout: { participant: field, researcher: { ...field, x: .62 }, participant_date: { ...field, y: .74 }, researcher_date: { ...field, x: .62, y: .74 } } })
    vi.stubGlobal('uni', { getSystemInfoSync: () => ({ windowWidth: 375 }), reLaunch: vi.fn().mockResolvedValue(undefined), previewImage: vi.fn() })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  async function page() {
    const Page = (await import('../uni-app/pages/access/consent.vue')).default
    const wrapper = mount(Page, { global: { stubs: {
      UniAccessPageShell: { name: 'UniAccessPageShell', template: '<div><slot /></div>' },
      SignatureSheet: { name: 'SignatureSheet', props: ['visible', 'busy', 'error', 'draft'], template: '<div class="sheet">{{ busy ? "处理中…" : error }}</div>' }
    } } })
    await settle()
    return wrapper
  }
  async function complete(wrapper: Awaited<ReturnType<typeof page>>, value = draft()) {
    await wrapper.get('.consent-document-field--signature').trigger('click')
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    sheet.vm.$emit('change', value)
    sheet.vm.$emit('complete', image())
    await settle()
    return sheet
  }
  async function agree(wrapper: Awaited<ReturnType<typeof page>>) {
    wrapper.get('checkbox-group').element.dispatchEvent(new CustomEvent('change', { detail: { value: ['agree'] } }))
    await settle()
  }
  it('saves a valid signature locally and sends nothing until agreement and submit', async () => {
    const wrapper = await page()
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
    await complete(wrapper)
    expect(wrapper.get('.consent-signed-image').attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(backend.submitStudyConsent).not.toHaveBeenCalled()
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
    await agree(wrapper)
    await wrapper.get('.consent-confirm').trigger('click'); await settle()
    expect(backend.submitStudyConsent).toHaveBeenCalledWith(expect.objectContaining({ agree: true, template_id: 1,
      client_recognition: { method: 'wechat-visionkit', text: '李芳滨' } }))
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/access/questionnaire?checkpoint=baseline' })
    wrapper.unmount()
  })
  it('discards unverified edits when closing and restores the last verified strokes', async () => {
    const wrapper = await page(), saved = draft()
    const sheet = await complete(wrapper, saved)
    await wrapper.get('.consent-document-field--signature').trigger('click')
    expect(sheet.props('draft')).toEqual(saved)
    sheet.vm.$emit('change', draft(80)); sheet.vm.$emit('close'); await settle()
    await wrapper.get('.consent-document-field--signature').trigger('click')
    expect(sheet.props('draft')).toEqual(saved)
    expect(backend.submitStudyConsent).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('drops the first failed draft without sending an error history to the server', async () => {
    recognizer.recognize.mockRejectedValue(new Error('signature_detection_timeout'))
    const wrapper = await page(), sheet = await complete(wrapper)
    expect(sheet.props('error')).toContain('请点击“重写”')
    expect(wrapper.text()).not.toMatch(/OCR|超时/)
    expect(backend.submitStudyConsent).not.toHaveBeenCalled()
    sheet.vm.$emit('close'); await settle()
    await wrapper.get('.consent-document-field--signature').trigger('click')
    expect(sheet.props('draft')).toBeNull()
    expect(wrapper.find('.consent-signed-image').exists()).toBe(false)
    wrapper.unmount()
  })
  it('preserves a previously verified signature when the next edited signature fails', async () => {
    const wrapper = await page(), saved = draft(), sheet = await complete(wrapper, saved)
    recognizer.recognize.mockResolvedValueOnce('其他姓名')
    await complete(wrapper, draft(80))
    sheet.vm.$emit('close'); await settle()
    await wrapper.get('.consent-document-field--signature').trigger('click')
    expect(sheet.props('draft')).toEqual(saved)
    expect(wrapper.find('.consent-signed-image').exists()).toBe(true)
    wrapper.unmount()
  })
  it('keeps signed height and left edge but narrows the frame to the real image aspect', async () => {
    const wrapper = await page(), box = wrapper.get('.consent-document-field--signature').element as HTMLElement
    const before = { left: box.style.left, height: box.style.height, width: parseFloat(box.style.width), top: box.style.top }
    await complete(wrapper)
    expect(box.style.left).toBe(before.left); expect(box.style.height).toBe(before.height); expect(box.style.top).toBe(before.top)
    expect(parseFloat(box.style.width)).toBeLessThan(before.width)
    wrapper.unmount()
  })
  it('retries formal submission with the same request ID after a lost response', async () => {
    backend.submitStudyConsent.mockRejectedValueOnce(new Error('network'))
    const wrapper = await page(); await complete(wrapper); await agree(wrapper)
    await wrapper.get('.consent-confirm').trigger('click'); await settle()
    expect(uni.reLaunch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('已保留您的签名')
    expect(wrapper.find('.consent-signed-image').exists()).toBe(true)
    await wrapper.get('.consent-confirm').trigger('click'); await settle()
    expect(backend.submitStudyConsent.mock.calls[1][0].client_request_id).toBe(backend.submitStudyConsent.mock.calls[0][0].client_request_id)
    expect(uni.reLaunch).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
  it('reports service failure as a retryable submission error with its request ID', async () => {
    backend.submitStudyConsent.mockRejectedValueOnce(new BackendRequestError('文档服务暂不可用', 503, { requestId: 'consent-service-failed' }))
    const wrapper = await page(); await complete(wrapper); await agree(wrapper)
    await wrapper.get('.consent-confirm').trigger('click'); await settle()
    expect(wrapper.text()).toContain('已保留您的签名')
    expect(wrapper.text()).toContain('consent-service-failed')
    expect(wrapper.text()).not.toContain('重新签名后再试')
    expect(wrapper.find('.consent-signed-image').exists()).toBe(true)
    wrapper.unmount()
  })
  it('ignores late verification after outside close and keeps the mask outside the scrolling shell', async () => {
    let late!: (value: string) => void
    const cancel = vi.fn()
    recognizer.recognize.mockImplementationOnce((_pixels, register) => { register(cancel); return new Promise(resolve => { late = resolve }) })
    const wrapper = await page(), sheet = await complete(wrapper)
    expect(wrapper.findComponent({ name: 'UniAccessPageShell' }).element.contains(sheet.element)).toBe(false)
    sheet.vm.$emit('close'); await settle(); late('李芳滨'); await settle()
    expect(cancel).toHaveBeenCalledOnce()
    expect(wrapper.find('.consent-signed-image').exists()).toBe(false)
    expect(backend.submitStudyConsent).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
