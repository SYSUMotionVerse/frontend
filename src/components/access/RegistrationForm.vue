<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import type { StudentProfile } from '../../domain/student/types'

type RegistrationPayload = Omit<StudentProfile, 'completed'>

const props = withDefaults(defineProps<{
  submitting?: boolean
  submitLabel?: string
}>(), {
  submitting: false,
  submitLabel: '准备好了，出发！ 🚀'
})

const emit = defineEmits<{
  submit: [payload: RegistrationPayload]
}>()

const form = reactive<RegistrationPayload>({
  studentId: '',
  name: '',
  gender: '',
  age: 0,
  major: '',
  grade: '',
  heightCm: 0,
  weightKg: 0,
  restingHeartRate: 0
})

const genderOptions = ['女', '男']
const gradeOptions = ['一年级', '二年级', '三年级', '四年级']
const consentGiven = shallowRef(false)

const selectedGenderIndex = computed(() => {
  const index = genderOptions.indexOf(form.gender)

  return index >= 0 ? index : 0
})

const selectedGradeIndex = computed(() => {
  const index = gradeOptions.indexOf(form.grade)

  return index >= 0 ? index : 0
})

function readInputValue(event: Event | { detail?: { value?: string | number }; target?: { value?: string | number } }) {
  const nextEvent = event as {
    detail?: { value?: unknown }
    target?: EventTarget | { value?: unknown } | null
  }

  const detailValue = nextEvent.detail?.value
  if (typeof detailValue === 'string' || typeof detailValue === 'number') {
    return String(detailValue)
  }

  const targetValue = (nextEvent.target as { value?: unknown } | null | undefined)?.value
  if (typeof targetValue === 'string' || typeof targetValue === 'number') {
    return String(targetValue)
  }

  return ''
}

function sanitizeDigits(value: string, maxLength?: number) {
  const digitsOnly = value.replace(/\D/g, '')

  return typeof maxLength === 'number'
    ? digitsOnly.slice(0, maxLength)
    : digitsOnly
}

function handleStudentIdInput(event: Event | { detail?: { value?: string | number }; target?: { value?: string | number } }) {
  form.studentId = sanitizeDigits(readInputValue(event), 8)
}

function handleNumericFieldInput(
  field: 'age' | 'heightCm' | 'weightKg' | 'restingHeartRate',
  event: Event | { detail?: { value?: string | number }; target?: { value?: string | number } }
) {
  const digits = sanitizeDigits(readInputValue(event))

  form[field] = digits.length > 0 ? Number(digits) : 0
}

const canSubmit = computed(() => {
  return (
    /^\d{8}$/.test(form.studentId) &&
    form.name.trim().length > 0 &&
    genderOptions.includes(form.gender) &&
    form.major.trim().length > 0 &&
    form.grade.trim().length > 0 &&
    form.age > 0 &&
    form.heightCm > 0 &&
    form.weightKg > 0 &&
    form.restingHeartRate > 0
    && consentGiven.value
  )
})

function handleSubmit() {
  if (!canSubmit.value || props.submitting) {
    return
  }

  emit('submit', { ...form })
}

function handleGenderChange(event: { detail?: { value?: string | number } }) {
  const nextIndex = Number(event.detail?.value ?? 0)

  form.gender = genderOptions[nextIndex] ?? ''
}

function handleGradeChange(event: { detail?: { value?: string | number } }) {
  const nextIndex = Number(event.detail?.value ?? 0)

  form.grade = gradeOptions[nextIndex] ?? ''
}

function handleConsentChange(event: { detail?: { value?: string[] } }) {
  consentGiven.value = event.detail?.value?.includes('profile-upload') === true
}
</script>

<template>
  <form class="registration-form" @submit.prevent="handleSubmit">
    <view class="form-card form-card--gold">
      <view class="form-card__header">
        <view class="form-card__heading">
          <text class="form-card__kicker form-card__kicker--gold">基本信息</text>
        </view>
      </view>

      <view class="form-stack-field">
        <text class="registration-label">学号</text>
        <input
          :value="form.studentId"
          aria-label="学号"
          autocomplete="username"
          class="input-shell registration-input-shell"
          inputmode="numeric"
          maxlength="8"
          name="studentId"
          placeholder="八位数字，例如：20260001"
          type="text"
          @input="handleStudentIdInput"
        />
      </view>

      <view class="form-stack-field">
        <text class="registration-label">姓名</text>
        <input v-model.trim="form.name" aria-label="姓名" autocomplete="name" class="input-shell registration-input-shell" name="name" placeholder="例如：运动小明" />
      </view>

      <view class="form-row">
        <view class="form-row__field">
          <text class="registration-label">性别</text>
          <picker
            aria-label="性别"
            class="registration-picker-shell"
            mode="selector"
            :range="genderOptions"
            :value="selectedGenderIndex"
            @change="handleGenderChange"
          >
            <view class="input-shell registration-input-shell registration-input-shell--picker flex items-center">
              {{ form.gender || '请选择' }}
            </view>
          </picker>
        </view>
        
        <view class="form-row__field">
          <text class="registration-label">年龄</text>
          <input
            :value="form.age > 0 ? String(form.age) : ''"
            aria-label="年龄"
            autocomplete="off"
            class="input-shell registration-input-shell"
            inputmode="numeric"
            maxlength="3"
            name="age"
            placeholder="20"
            type="text"
            @input="handleNumericFieldInput('age', $event)"
          />
        </view>
      </view>
      
      <view class="form-row">
        <view class="form-row__field">
          <text class="registration-label">专业</text>
          <input v-model.trim="form.major" aria-label="专业" autocomplete="organization-title" class="input-shell registration-input-shell" name="major" placeholder="理科..." />
        </view>
        
        <view class="form-row__field">
          <text class="registration-label">年级</text>
          <picker
            aria-label="年级"
            class="registration-picker-shell"
            mode="selector"
            :range="gradeOptions"
            :value="selectedGradeIndex"
            @change="handleGradeChange"
          >
            <view class="input-shell registration-input-shell registration-input-shell--picker flex items-center">
              {{ form.grade || '请选择' }}
            </view>
          </picker>
        </view>
      </view>
    </view>

    <view class="form-card form-card--teal">
      <view class="form-card__header">
        <view class="form-card__heading">
          <text class="form-card__kicker form-card__kicker--teal">健康指标</text>
        </view>
      </view>

      <view class="form-row">
        <view class="form-row__field">
          <text class="registration-label">身高 (cm)</text>
          <input
            :value="form.heightCm > 0 ? String(form.heightCm) : ''"
            aria-label="身高（厘米）"
            autocomplete="off"
            class="input-shell registration-input-shell"
            inputmode="numeric"
            maxlength="3"
            name="heightCm"
            placeholder="160"
            type="text"
            @input="handleNumericFieldInput('heightCm', $event)"
          />
        </view>

        <view class="form-row__field">
          <text class="registration-label">体重 (kg)</text>
          <input
            :value="form.weightKg > 0 ? String(form.weightKg) : ''"
            aria-label="体重（千克）"
            autocomplete="off"
            class="input-shell registration-input-shell"
            inputmode="numeric"
            maxlength="3"
            name="weightKg"
            placeholder="50"
            type="text"
            @input="handleNumericFieldInput('weightKg', $event)"
          />
        </view>
      </view>

      <view class="form-stack-field">
        <text class="registration-label">静息心率 (bpm)</text>
        <input
          :value="form.restingHeartRate > 0 ? String(form.restingHeartRate) : ''"
          aria-label="静息心率"
          autocomplete="off"
          class="input-shell registration-input-shell"
          inputmode="numeric"
          maxlength="3"
          name="restingHeartRate"
          placeholder="70"
          type="text"
          @input="handleNumericFieldInput('restingHeartRate', $event)"
        />
      </view>
    </view>

    <checkbox-group class="registration-consent" @change="handleConsentChange">
      <label class="registration-consent__label">
        <checkbox
          class="registration-consent__control"
          value="profile-upload"
          :checked="consentGiven"
          color="#ff7777"
        />
        <text>我同意上传这些信息以建立初始训练档案。</text>
      </label>
    </checkbox-group>

    <button form-type="submit" class="btn-primary registration-submit" :disabled="!canSubmit || props.submitting">
      <text class="tracking-wide">{{ props.submitting ? '正在提交…' : props.submitLabel }}</text>
    </button>

    <view class="form-card__footer-note">
      <text>这些信息用于建立初始训练档案，请确认准确后提交。</text>
    </view>
  </form>
</template>

<style scoped>
.registration-form {
  display: flex;
  flex-direction: column;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.form-row__field {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 16rpx;
  min-width: 0;
}

.form-stack-field {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16rpx;
}

.registration-input-shell {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.registration-input-shell--picker {
  justify-content: space-between;
}

.registration-picker-shell {
  display: block;
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
  box-sizing: border-box;
}

.registration-label {
  margin-left: 24rpx;
  color: #1A202C;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.3;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  padding: 40rpx;
  border-radius: 48rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 0 rgba(0, 0, 0, 0.05);
}

.form-card--gold {
  border: 8rpx solid rgba(255, 211, 132, 0.25);
}

.form-card--teal {
  border: 8rpx solid rgba(137, 207, 255, 0.25);
}

.form-card__header {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.form-card__heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12rpx;
}

.form-card__kicker {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8rpx 18rpx;
  border-radius: 9999px;
  font-size: 24rpx;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.form-card__kicker--gold {
  color: #D97706;
  background: rgba(255, 211, 132, 0.14);
  border: 4rpx solid rgba(255, 211, 132, 0.22);
}

.form-card__kicker--teal {
  color: #2B7CB8;
  background: rgba(137, 207, 255, 0.14);
  border: 4rpx solid rgba(137, 207, 255, 0.22);
}

.form-card--gold {
  margin-bottom: 48rpx;
}

.form-card--teal {
  margin-bottom: 48rpx;
}

.registration-consent {
  display: flex;
  width: 100%;
  margin-bottom: 28rpx;
  justify-content: center;
}

.registration-consent__label {
  display: flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 8rpx;
  color: #536176;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.4;
}

.registration-consent__control {
  display: flex;
  flex: none;
  transform: scale(0.9);
  transform-origin: center;
}

.registration-submit {
  margin: 0;
}

.form-card__footer-note {
  display: flex;
  justify-content: center;
  margin: 16rpx 0 48rpx;
  padding: 0 20rpx;
  color: #9aa5b3;
  font-size: 22rpx;
  line-height: 1.5;
  font-weight: 600;
  text-align: center;
}
</style>
