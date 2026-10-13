import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  loadStudyConsent: vi.fn(), uploadConsentSignature: vi.fn(), acceptStudyConsent: vi.fn(), bootstrapAccess: vi.fn()
}))
vi.mock('../uni-app/api/studentBackend', () => ({ studentBackendSync: backend }))
vi.mock('../uni-app/platform/signatureOcr', () => ({ recognizeSignatureWithVisionKit: vi.fn().mockResolvedValue('李芳滨') }))

describe('informed consent page', () => {
  beforeEach(() => {
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
})
