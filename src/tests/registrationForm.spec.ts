import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistrationForm from '../components/access/RegistrationForm.vue'

const avatarController = {
  avatarUrl: '',
  avatarSource: '' as '' | 'wechat' | 'album' | 'camera',
  uploadState: 'idle' as 'idle' | 'uploading' | 'success' | 'error',
  errorMessage: '',
  isWechatMiniProgram: true,
  supportsWechatAvatarSelection: true,
  handleWechatAvatarChoice: vi.fn(),
  handleLocalAvatarChoice: vi.fn()
}

vi.mock('../uni-app/composables/useRegistrationAvatar', () => ({
  useRegistrationAvatar: () => avatarController
}))

function mountForm() {
  return mount(RegistrationForm, {
    global: {
      stubs: {
        picker: {
          name: 'PickerStub',
          template: '<div class="picker-stub"><slot /></div>'
        }
      }
    }
  })
}

async function fillValidProfileFields(wrapper: ReturnType<typeof mountForm>) {
  await wrapper.get('input[name="studentId"]').setValue('20260001')
  await wrapper.get('input[name="name"]').setValue('Lin')
  await wrapper.get('input[name="major"]').setValue('Sports Science')

  const pickers = wrapper.findAll('.picker-stub')
  await pickers[0]?.trigger('change', { detail: { value: 0 } })
  await pickers[1]?.trigger('change', { detail: { value: 0 } })
}

describe('registration form', () => {
  beforeEach(() => {
    avatarController.avatarUrl = ''
    avatarController.avatarSource = ''
    avatarController.uploadState = 'idle'
    avatarController.errorMessage = ''
    avatarController.supportsWechatAvatarSelection = true
    avatarController.handleWechatAvatarChoice.mockReset()
    avatarController.handleLocalAvatarChoice.mockReset()
  })

  it('emits submit with a default avatar when no upload has happened', async () => {
    const wrapper = mountForm()
    await fillValidProfileFields(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        expect.objectContaining({
          studentId: '20260001',
          name: 'Lin',
          major: 'Sports Science',
          gender: '女',
          grade: '一年级',
          avatarUrl: expect.any(String),
          avatarSource: ''
        })
      ]
    ])
  })

  it('does not emit submit when student id is not exactly 8 digits', async () => {
    const wrapper = mountForm()
    await fillValidProfileFields(wrapper)
    await wrapper.get('input[name="studentId"]').setValue('2026000')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('sanitizes numeric-only fields before submit', async () => {
    const wrapper = mountForm()
    await fillValidProfileFields(wrapper)

    await wrapper.get('input[name="studentId"]').setValue('2026-0001abc')
    await wrapper.get('input[name="age"]').setValue('12岁')
    await wrapper.get('input[name="heightCm"]').setValue('170cm')
    await wrapper.get('input[name="weightKg"]').setValue('55kg')
    await wrapper.get('input[name="restingHeartRate"]').setValue('70bpm')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        expect.objectContaining({
          studentId: '20260001',
          age: 12,
          heightCm: 170,
          weightKg: 55,
          restingHeartRate: 70
        })
      ]
    ])
  })

  it('emits avatar metadata once upload succeeds', async () => {
    avatarController.avatarUrl = 'https://cdn.example.com/avatar.png'
    avatarController.avatarSource = 'wechat'
    avatarController.uploadState = 'success'

    const wrapper = mountForm()
    await fillValidProfileFields(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        expect.objectContaining({
          studentId: '20260001',
          name: 'Lin',
          major: 'Sports Science',
          gender: '女',
          grade: '一年级',
          avatarUrl: 'https://cdn.example.com/avatar.png',
          avatarSource: 'wechat'
        })
      ]
    ])
  })

  it('keeps submit available with a default avatar when chooseAvatar is unsupported', async () => {
    avatarController.supportsWechatAvatarSelection = false
    avatarController.errorMessage = '游客模式下暂不支持直接选择微信头像。'

    const wrapper = mountForm()
    await fillValidProfileFields(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        expect.objectContaining({
          avatarUrl: expect.any(String),
          avatarSource: ''
        })
      ]
    ])
  })
})
