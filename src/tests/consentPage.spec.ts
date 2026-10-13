import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  loadStudyConsent: vi.fn(), uploadConsentSignature: vi.fn(), acceptStudyConsent: vi.fn(), bootstrapAccess: vi.fn()
}))
const ocr = vi.hoisted(() => vi.fn())
const recognizer = vi.hoisted(() => ({ prepare: vi.fn(), dispose: vi.fn() }))
vi.mock('../uni-app/api/studentBackend', () => ({ studentBackendSync: backend }))
vi.mock('../uni-app/platform/signatureOcr', async importOriginal => ({
  ...await importOriginal<typeof import('../uni-app/platform/signatureOcr')>(), createSignatureRecognizer: () => ({ ...recognizer, recognize: ocr })
}))

async function settleUpload() {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(5)
  await flushPromises()
}

describe('informed consent page', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  beforeEach(() => {
    vi.useFakeTimers()
    ocr.mockReset()
    ocr.mockResolvedValue('李芳滨')
    recognizer.prepare.mockReset().mockResolvedValue(undefined)
    recognizer.dispose.mockReset()
    backend.uploadConsentSignature.mockReset()
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
      UniAccessPageShell: { name: 'UniAccessPageShell', template: '<div><slot /></div>' },
      SignatureSheet: { name: 'SignatureSheet', props: ['visible', 'error', 'busy', 'draft'], template: '<div class="sheet">{{ error }}</div>' }
    } } })
    await settleUpload()
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
    await settleUpload()
    expect(parseFloat(field.style.fontSize)).toBeLessThan(before)
    expect(wrapper.text()).not.toContain('日期：')
    expect(wrapper.text().match(/2026年10月13日/g)).toHaveLength(2)
  })
  it('asks for a new signature after OCR rejection and never confirms the rejected attempt', async () => {
    backend.uploadConsentSignature.mockResolvedValue({ id: 'bad', status: 'REJECTED', error: '请重新签名' })
    const wrapper = await page()
    wrapper.findComponent({ name: 'SignatureSheet' }).vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(), width: 1, height: 1 } })
    await settleUpload()
    expect(wrapper.text()).toContain('请点击“重写”')
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
    expect(backend.acceptStudyConsent).not.toHaveBeenCalled()
  })
  it('only confirms the verified attempt after agreement and then routes using backend progress', async () => {
    const wrapper = await page()
    wrapper.findComponent({ name: 'SignatureSheet' }).vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(), width: 1, height: 1 } })
    await settleUpload()
    wrapper.get('checkbox-group').element.dispatchEvent(new CustomEvent('change', { detail: { value: ['agree'] } }))
    await settleUpload()
    await wrapper.get('.consent-confirm').trigger('click')
    await settleUpload()
    expect(backend.acceptStudyConsent).toHaveBeenCalledWith('verified')
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/access/questionnaire?checkpoint=baseline' })
  })
  it('archives diagnostic errors while showing only a user-facing rewrite prompt', async () => {
    ocr.mockRejectedValue(new Error('当前微信不支持签名识别，请更新微信后重新签名。'))
    backend.uploadConsentSignature.mockResolvedValue({ id: 'bad', status: 'REJECTED', error: '需重签' })
    const wrapper = await page()
    wrapper.findComponent({ name: 'SignatureSheet' }).vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(), width: 1, height: 1 } })
    await settleUpload()
    expect(backend.uploadConsentSignature).toHaveBeenCalledWith(expect.objectContaining({
      image_base64: 'png', client_recognition: { method: 'wechat-visionkit', text: '', error: '当前微信不支持签名识别，请更新微信后重新签名。' }
    }))
    expect(wrapper.text()).toContain('请点击“重写”')
    expect(wrapper.text()).not.toMatch(/OCR|超时|更新微信/)
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
  })
  it('recovers from a stalled upload, ignores the late result and retries with the same request ID', async () => {
    vi.useFakeTimers()
    let resolveLate!: (value: unknown) => void
    backend.uploadConsentSignature.mockImplementationOnce(() => new Promise(resolve => { resolveLate = resolve }))
    const wrapper = await page()
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    const input = { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(4), width: 1, height: 1 } }
    sheet.vm.$emit('complete', input)
    await settleUpload()
    expect(sheet.props('busy')).toBe(true)
    await vi.advanceTimersByTimeAsync(35000)
    await settleUpload()
    expect(sheet.props('busy')).toBe(false)
    expect(wrapper.text()).toContain('请点击“重写”')
    expect(wrapper.text()).not.toContain('超时')
    resolveLate({ id: 'late', status: 'VERIFIED', image_url: 'late.png' })
    await settleUpload()
    expect(wrapper.find('.consent-signed-image').exists()).toBe(false)
    sheet.vm.$emit('complete', input)
    await settleUpload()
    expect(backend.uploadConsentSignature.mock.calls[1][0].client_request_id).toBe(backend.uploadConsentSignature.mock.calls[0][0].client_request_id)
    expect(wrapper.find('.consent-signed-image').exists()).toBe(true)
    wrapper.unmount()
  })
  it('reports a stalled OCR call and archives a rejected attempt without keeping the sheet locked', async () => {
    vi.useFakeTimers()
    ocr.mockImplementationOnce(() => new Promise(() => {}))
    backend.uploadConsentSignature.mockResolvedValue({ status: 'REJECTED', error: '需重签' })
    const wrapper = await page()
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    sheet.vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(4), width: 1, height: 1 } })
    await settleUpload()
    await vi.advanceTimersByTimeAsync(30000)
    await settleUpload()
    expect(sheet.props('busy')).toBe(false)
    expect(wrapper.text()).toContain('请点击“重写”')
    expect(wrapper.text()).not.toMatch(/OCR|超时/)
    expect(backend.uploadConsentSignature.mock.calls[0][0].client_recognition.error).toContain('signature_recognition_deadline')
    expect(wrapper.get('.consent-confirm').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('mounts the signature mask outside the scrolling shell so it covers the navigation title', async () => {
    const wrapper = await page()
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    expect(wrapper.findComponent({ name: 'UniAccessPageShell' }).element.contains(sheet.element)).toBe(false)
    wrapper.unmount()
  })
  it('cancels recognition on outside close and ignores the result of a previous upload after reopening', async () => {
    let resolveLate!: (value: unknown) => void
    backend.uploadConsentSignature.mockImplementationOnce(() => new Promise(resolve => { resolveLate = resolve }))
    const cancel = vi.fn()
    ocr.mockImplementationOnce((_pixels, registerCancel) => {
      registerCancel(cancel)
      return Promise.resolve('李芳滨')
    })
    const wrapper = await page()
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    await wrapper.get('.consent-document-field--signature').trigger('click')
    sheet.vm.$emit('complete', { imageBase64: 'old', pixels: { data: new Uint8ClampedArray(4), width: 1, height: 1 } })
    await settleUpload()
    sheet.vm.$emit('close')
    await settleUpload()
    expect(cancel).toHaveBeenCalledOnce()
    expect(sheet.props('busy')).toBe(false)
    expect(sheet.props('visible')).toBe(false)
    await wrapper.get('.consent-document-field--signature').trigger('click')
    resolveLate({ id: 'old', status: 'VERIFIED', image_url: 'old.png' })
    await settleUpload()
    expect(wrapper.find('.consent-signed-image').exists()).toBe(false)
    expect(sheet.props('visible')).toBe(true)
    wrapper.unmount()
  })
  it('prepares while the user writes and keeps the signed draft when reopening the canvas', async () => {
    const wrapper = await page()
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    await wrapper.get('.consent-document-field--signature').trigger('click')
    expect(recognizer.prepare).toHaveBeenCalledOnce()
    const draft = { width: 319, height: 190, strokes: [[[20, 30, 25, 35]]] }
    sheet.vm.$emit('change', draft)
    sheet.vm.$emit('complete', { imageBase64: 'png', pixels: { data: new Uint8ClampedArray(4), width: 1, height: 1 } })
    await settleUpload()
    expect(sheet.props('visible')).toBe(false)
    await wrapper.get('.consent-document-field--signature').trigger('click')
    expect(sheet.props('draft')).toEqual(draft)
    expect(sheet.props('visible')).toBe(true)
    wrapper.unmount()
    expect(recognizer.dispose).toHaveBeenCalledOnce()
  })
  it('allows immediate rewriting while archiving a failed attempt and ignores the archive result', async () => {
    ocr.mockRejectedValue(new Error('signature_detection_timeout'))
    let finishArchive!: (value: unknown) => void
    backend.uploadConsentSignature.mockImplementationOnce(() => new Promise(resolve => { finishArchive = resolve }))
    const wrapper = await page()
    const sheet = wrapper.findComponent({ name: 'SignatureSheet' })
    await wrapper.get('.consent-document-field--signature').trigger('click')
    sheet.vm.$emit('complete', { imageBase64: 'bad', pixels: { data: new Uint8ClampedArray(4), width: 1, height: 1 } })
    await settleUpload()
    expect(sheet.props('busy')).toBe(false)
    expect(sheet.props('error')).toContain('请点击“重写”')
    sheet.vm.$emit('change', { width: 319, height: 190, strokes: [] })
    await settleUpload()
    expect(sheet.props('error')).toBe('')
    finishArchive({ id: 'old', status: 'REJECTED', error: 'OCR 超时' })
    await settleUpload()
    expect(sheet.props('error')).toBe('')
    expect(wrapper.text()).not.toMatch(/OCR|超时/)
    wrapper.unmount()
  })
})
