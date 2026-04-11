<script setup lang="ts">
import { computed, reactive, unref } from 'vue'
import type { StudentProfile } from '../../domain/student/types'
import { DEFAULT_AVATAR_URL } from '../../constants/defaultAvatar'
import RegistrationAvatarField from './RegistrationAvatarField.vue'
import { useRegistrationAvatar } from '../../uni-app/composables/useRegistrationAvatar'

type RegistrationPayload = Omit<StudentProfile, 'completed'>

const emit = defineEmits<{
  submit: [payload: RegistrationPayload]
}>()

const avatar = useRegistrationAvatar()
const form = reactive<RegistrationPayload>({
  avatarUrl: '',
  avatarSource: '',
  studentId: '',
  name: '',
  gender: '',
  age: 12,
  major: '',
  grade: '',
  heightCm: 150,
  weightKg: 40,
  restingHeartRate: 70
})

const genderOptions = ['女', '男', '其他']
const gradeOptions = ['一年级', '二年级', '三年级', '四年级']

const currentAvatarUrl = computed(() => unref(avatar.avatarUrl) ?? '')
const currentAvatarSource = computed(() => unref(avatar.avatarSource) ?? '')
const currentAvatarUploadState = computed(() => unref(avatar.uploadState) ?? 'idle')
const currentAvatarErrorMessage = computed(() => unref(avatar.errorMessage) ?? '')
const showWechatAvatarButton = computed(() => Boolean(unref(avatar.isWechatMiniProgram)))
const supportsWechatAvatarSelection = computed(() => Boolean(unref(avatar.supportsWechatAvatarSelection)))
const resolvedAvatarUrl = computed(() => currentAvatarUrl.value.trim() || DEFAULT_AVATAR_URL)

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
    form.gender.trim().length > 0 &&
    form.major.trim().length > 0 &&
    form.grade.trim().length > 0 &&
    currentAvatarUploadState.value !== 'uploading' &&
    form.age > 0 &&
    form.heightCm > 0 &&
    form.weightKg > 0 &&
    form.restingHeartRate > 0
  )
})

function handleSubmit() {
  if (!canSubmit.value) {
    return
  }

  emit('submit', {
    ...form,
    avatarUrl: resolvedAvatarUrl.value,
    avatarSource: currentAvatarSource.value
  })
}

function handleGenderChange(event: { detail?: { value?: string | number } }) {
  const nextIndex = Number(event.detail?.value ?? 0)

  form.gender = genderOptions[nextIndex] ?? ''
}

function handleGradeChange(event: { detail?: { value?: string | number } }) {
  const nextIndex = Number(event.detail?.value ?? 0)

  form.grade = gradeOptions[nextIndex] ?? ''
}
</script>

<template>
  <form class="flex flex-col gap-[32rpx]" @submit.prevent="handleSubmit">
    <view class="form-card form-card--gold">
      <view class="form-card__header">
        <view class="form-card__heading">
          <text class="form-card__kicker form-card__kicker--gold">基本信息</text>
          <text class="form-card__title">填写今天加入训练的同学信息。</text>
        </view>
      </view>

      <RegistrationAvatarField
        :avatar-url="resolvedAvatarUrl"
        :upload-state="currentAvatarUploadState"
        :error-message="currentAvatarErrorMessage"
        :is-wechat-mini-program="showWechatAvatarButton"
        :supports-wechat-avatar-selection="supportsWechatAvatarSelection"
        @choose-wechat-avatar="avatar.handleWechatAvatarChoice"
      />
      
      <view class="form-stack-field">
        <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">学号</text>
        <input
          :value="form.studentId"
          autocomplete="username"
          class="input-shell registration-input-shell"
          inputmode="numeric"
          maxlength="8"
          name="studentId"
          placeholder="例如：20260001"
          type="text"
          @input="handleStudentIdInput"
        />
      </view>

      <view class="form-stack-field">
        <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">姓名</text>
        <input v-model.trim="form.name" autocomplete="name" class="input-shell registration-input-shell" name="name" placeholder="例如：运动小明" />
      </view>

      <view class="form-row">
        <view class="form-row__field flex flex-col gap-[16rpx]">
          <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">性别</text>
          <picker
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
        
        <view class="form-row__field flex flex-col gap-[16rpx]">
          <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">年龄</text>
          <input
            :value="String(form.age)"
            autocomplete="off"
            class="input-shell registration-input-shell"
            inputmode="numeric"
            maxlength="3"
            name="age"
            placeholder="12"
            type="text"
            @input="handleNumericFieldInput('age', $event)"
          />
        </view>
      </view>
      
      <view class="form-row">
        <view class="form-row__field flex flex-col gap-[16rpx]">
          <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">专业</text>
          <input v-model.trim="form.major" autocomplete="organization-title" class="input-shell registration-input-shell" name="major" placeholder="理科..." />
        </view>
        
        <view class="form-row__field flex flex-col gap-[16rpx]">
          <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">年级</text>
          <picker
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
        <view class="form-card__sticker form-card__sticker--teal">
          <text class="text-[40rpx]">💓</text>
        </view>
        <view class="form-card__heading">
          <text class="form-card__kicker form-card__kicker--teal">健康指标</text>
          <text class="form-card__title">在训练开始前补充基础数据。</text>
        </view>
      </view>

      <view class="form-row">
        <view class="form-row__field flex flex-col gap-[16rpx]">
          <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">身高 (cm)</text>
          <input
            :value="String(form.heightCm)"
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

        <view class="form-row__field flex flex-col gap-[16rpx]">
          <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">体重 (kg)</text>
          <input
            :value="String(form.weightKg)"
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
        <text class="text-[28rpx] font-800 text-[#1A202C] ml-[12rpx]">静息心率 (bpm)</text>
        <input
          :value="String(form.restingHeartRate)"
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

    <view class="form-card__footer-note">
      <text>这里的一切仅用于设置您的初始个人资料。您可以稍后完善它。</text>
    </view>

    <button form-type="submit" class="btn-primary mt-[24rpx] mb-[48rpx]" :disabled="!canSubmit">
      <text class="tracking-wide">准备好了，出发！ 🚀</text>
    </button>
  </form>
</template>

<style scoped>
.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.form-row__field {
  flex: 1 1 0;
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
  display: flex;
  width: 100%;
  box-sizing: border-box;
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

.form-card__sticker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 84rpx;
  height: 84rpx;
  flex: none;
  border-radius: 9999px;
  border: 4rpx solid #ffffff;
  box-shadow: 0 8rpx 0 rgba(0, 0, 0, 0.04);
}

.form-card__sticker--gold {
  background: rgba(255, 211, 132, 0.24);
}

.form-card__sticker--teal {
  background: rgba(137, 207, 255, 0.24);
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

.form-card__title {
  display: block;
  color: #1A202C;
  font-size: 34rpx;
  line-height: 1.35;
  font-weight: 900;
}

.form-card__footer-note {
  display: flex;
  justify-content: center;
  padding: 0 16rpx;
  color: #64748B;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
  text-align: center;
}
</style>
