import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegistrationForm from '../components/access/RegistrationForm.vue'

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
  it('emits profile data without personal avatar metadata', async () => {
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
          grade: '一年级'
        })
      ]
    ])
    expect(wrapper.emitted('submit')?.[0]?.[0]).not.toHaveProperty('avatarUrl')
    expect(wrapper.emitted('submit')?.[0]?.[0]).not.toHaveProperty('avatarSource')
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

})
