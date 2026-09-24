import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegistrationForm from '../components/access/RegistrationForm.vue'
import { registrationCollegeOptions, registrationGradeOptions } from '../features/access/registrationOptions'

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

  for (const label of ['性别', '年级', '在读学历']) {
    await wrapper.get(`.picker-stub[aria-label="${label}"]`).trigger('change', { detail: { value: 0 } })
  }
  await wrapper.get('.picker-stub[aria-label="学院"]').trigger('change', {
    detail: { value: registrationCollegeOptions.indexOf('体育部') }
  })
  await wrapper.get('checkbox-group').trigger('change', {
    detail: { value: ['profile-upload'] }
  })
}

describe('registration form', () => {
  it('offers descending enrollment years through 2020 and rolls forward with the year', () => {
    expect(registrationGradeOptions(new Date('2026-09-20T00:00:00Z'))).toEqual([
      '2026级', '2025级', '2024级', '2023级', '2022级', '2021级', '2020级'
    ])
    expect(registrationGradeOptions(new Date('2026-12-31T16:00:00Z'))[0]).toBe('2027级')
  })

  it('offers the 34 supplied colleges as a required picker, including full compound names', async () => {
    const wrapper = mountForm()
    expect(wrapper.find('input[name="college"]').exists()).toBe(false)
    const collegePicker = wrapper.findAllComponents({ name: 'PickerStub' })
      .find(picker => picker.attributes('aria-label') === '学院')!
    expect(collegePicker.props('range')).toHaveLength(34)
    expect(collegePicker.props('range')).toContain('法学院（知识产权学院、中英国际海事法商学院）')
    expect(collegePicker.props('range')).toContain('电子与信息工程学院（微电子学院）')
    expect(collegePicker.props('range')).toContain('未来生物医药学院')
    await fillValidProfileFields(wrapper)
    await collegePicker.trigger('change', { detail: { value: 999 } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
  it('uses the eight-digit hint and one shared label rhythm', () => {
    const wrapper = mountForm()

    expect(wrapper.get('input[name="studentId"]').attributes('placeholder'))
      .toBe('八位数字，例如：20260001')
    expect(wrapper.findAll('.registration-label')).toHaveLength(10)
    expect(wrapper.findAll('.form-row__field')).toHaveLength(8)
    expect(wrapper.text()).not.toContain('静息心率')
  })

  it('starts measured fields empty and uses 20 only as the age hint', () => {
    const wrapper = mountForm()

    expect(wrapper.get('input[name="age"]').attributes('placeholder')).toBe('20')
    for (const field of ['age', 'heightCm', 'weightKg']) {
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
          college: '体育部',
          educationLevel: '本科生',
          gender: '女',
          grade: registrationGradeOptions()[0]
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

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        expect.objectContaining({
          studentId: '20260001',
          age: 12,
          heightCm: 170,
          weightKg: 55
        })
      ]
    ])
  })

})
