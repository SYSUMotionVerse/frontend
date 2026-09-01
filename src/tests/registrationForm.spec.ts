import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegistrationForm from '../components/access/RegistrationForm.vue'

function mountForm() {
  return mount(RegistrationForm, {
    global: {
      stubs: {
        picker: {
          name: 'PickerStub',
          props: ['range'],
          template: '<div class="picker-stub"><span v-for="item in range" :key="item">{{ item }}</span><slot /></div>'
        }
      }
    }
  })
}

async function fillValidProfileFields(wrapper: ReturnType<typeof mountForm>) {
  await wrapper.get('input[name="studentId"]').setValue('20260001')
  await wrapper.get('input[name="name"]').setValue('Lin')
  await wrapper.get('input[name="major"]').setValue('Sports Science')
  await wrapper.get('input[name="age"]').setValue('12')
  await wrapper.get('input[name="heightCm"]').setValue('170')
  await wrapper.get('input[name="weightKg"]').setValue('55')
  await wrapper.get('input[name="restingHeartRate"]').setValue('70')

  const pickers = wrapper.findAll('.picker-stub')
  await pickers[0]?.trigger('change', { detail: { value: 0 } })
  await pickers[1]?.trigger('change', { detail: { value: 0 } })
  await wrapper.get('checkbox-group').trigger('change', {
    detail: { value: ['profile-upload'] }
  })
}

describe('registration form', () => {
  it('uses the eight-digit hint and one shared label rhythm', () => {
    const wrapper = mountForm()

    expect(wrapper.get('input[name="studentId"]').attributes('placeholder'))
      .toBe('八位数字，例如：20260001')
    expect(wrapper.findAll('.registration-label')).toHaveLength(9)
    expect(wrapper.findAll('.form-row__field')).toHaveLength(6)
  })

  it('starts measured fields empty and uses 20 only as the age hint', () => {
    const wrapper = mountForm()

    expect(wrapper.get('input[name="age"]').attributes('placeholder')).toBe('20')
    for (const field of ['age', 'heightCm', 'weightKg', 'restingHeartRate']) {
      expect(wrapper.get(`input[name="${field}"]`).element).toHaveProperty('value', '')
    }
  })

  it('only offers backend-supported gender values', () => {
    const wrapper = mountForm()

    expect(wrapper.text()).toContain('女')
    expect(wrapper.text()).toContain('男')
    expect(wrapper.text()).not.toContain('其他')
  })

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

  it('requires explicit consent before uploading the profile', async () => {
    const wrapper = mountForm()
    await wrapper.get('input[name="studentId"]').setValue('20260001')
    await wrapper.get('input[name="name"]').setValue('Lin')
    await wrapper.get('input[name="major"]').setValue('Sports Science')
    const pickers = wrapper.findAll('.picker-stub')
    await pickers[0]?.trigger('change', { detail: { value: 0 } })
    await pickers[1]?.trigger('change', { detail: { value: 0 } })

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('.registration-submit').attributes('disabled')).toBeDefined()
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
