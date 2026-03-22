<script setup lang="ts">
import { computed, reactive } from 'vue'

interface RegistrationPayload {
  studentId: string
  name: string
  gender: string
  age: number
  major: string
  grade: string
  heightCm: number
  weightKg: number
  restingHeartRate: number
}

const emit = defineEmits<{
  submit: [payload: RegistrationPayload]
}>()

const form = reactive<RegistrationPayload>({
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

const genderOptions = ['Female', 'Male', 'Other']
const gradeOptions = ['Year 1', 'Year 2', 'Year 3', 'Year 4']

const selectedGenderIndex = computed(() => {
  const index = genderOptions.indexOf(form.gender)

  return index >= 0 ? index : 0
})

const selectedGradeIndex = computed(() => {
  const index = gradeOptions.indexOf(form.grade)

  return index >= 0 ? index : 0
})

const canSubmit = computed(() => {
  return (
    form.studentId.trim().length > 0 &&
    form.name.trim().length > 0 &&
    form.gender.trim().length > 0 &&
    form.major.trim().length > 0 &&
    form.grade.trim().length > 0 &&
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
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
    <div class="bg-white p-8 rounded-[36px] shadow-sm border border-[#F0E6D8] flex flex-col gap-6">
      
      <div class="flex items-center gap-3 mb-2">
        <div class="inline-flex items-center justify-center p-2 rounded-full bg-[#FFF5E6] text-[#F59E0B]">
          <text class="text-[20px]">👤</text>
        </div>
        <text class="text-[12px] font-black uppercase tracking-widest text-[#F59E0B]">Basic Info</text>
      </div>
      
      <label class="flex flex-col gap-2.5">
        <text class="text-[14px] font-black text-[#1A202C] ml-2">Student ID</text>
        <input v-model.trim="form.studentId" autocomplete="username" class="input-shell" name="studentId" placeholder="E.g. S-001" />
      </label>

      <label class="flex flex-col gap-2.5">
        <text class="text-[14px] font-black text-[#1A202C] ml-2">Full Name</text>
        <input v-model.trim="form.name" autocomplete="name" class="input-shell" name="name" placeholder="E.g. Sporty Sam" />
      </label>

      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-2.5">
          <text class="text-[14px] font-black text-[#1A202C] ml-2">Gender</text>
          <div class="relative">
            <picker
              class="w-full"
              mode="selector"
              :range="genderOptions"
              :value="selectedGenderIndex"
              @change="handleGenderChange"
            >
              <view class="input-shell flex items-center">
                {{ form.gender || 'Select' }}
              </view>
            </picker>
          </div>
        </label>
        
        <label class="flex flex-col gap-2.5">
          <text class="text-[14px] font-black text-[#1A202C] ml-2">Age</text>
          <input v-model.number="form.age" autocomplete="off" class="input-shell" min="5" name="age" placeholder="12" type="number" />
        </label>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-2.5">
          <text class="text-[14px] font-black text-[#1A202C] ml-2">Major</text>
          <input v-model.trim="form.major" autocomplete="organization-title" class="input-shell" name="major" placeholder="Sci..." />
        </label>
        
        <label class="flex flex-col gap-2.5">
          <text class="text-[14px] font-black text-[#1A202C] ml-2">Grade</text>
          <div class="relative">
            <picker
              class="w-full"
              mode="selector"
              :range="gradeOptions"
              :value="selectedGradeIndex"
              @change="handleGradeChange"
            >
              <view class="input-shell flex items-center">
                {{ form.grade || 'Select' }}
              </view>
            </picker>
          </div>
        </label>
      </div>
    </div>

    <!-- Health Metrics Card -->
    <div class="bg-white p-8 rounded-[36px] shadow-sm border border-[#F0E6D8] flex flex-col gap-6 mt-2">
      <div class="flex items-center gap-3 mb-2">
        <div class="inline-flex items-center justify-center p-2 rounded-full bg-[#E0EDFF] text-[#4A90E2]">
          <text class="text-[20px]">💓</text>
        </div>
        <text class="text-[12px] font-black uppercase tracking-widest text-[#4A90E2]">Health Metrics</text>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-2.5">
          <text class="text-[14px] font-black text-[#1A202C] ml-2">Height (cm)</text>
          <input v-model.number="form.heightCm" autocomplete="off" class="input-shell" min="1" name="heightCm" placeholder="160" type="number" />
        </label>

        <label class="flex flex-col gap-2.5">
          <text class="text-[14px] font-black text-[#1A202C] ml-2">Weight (kg)</text>
          <input v-model.number="form.weightKg" autocomplete="off" class="input-shell" min="1" name="weightKg" placeholder="50" type="number" />
        </label>
      </div>

      <label class="flex flex-col gap-2.5">
        <text class="text-[14px] font-black text-[#1A202C] ml-2">Resting HR (bpm)</text>
        <input v-model.number="form.restingHeartRate" autocomplete="off" class="input-shell" min="1" name="restingHeartRate" placeholder="70" type="number" />
      </label>
    </div>

    <button form-type="submit" class="btn-primary mt-6 mb-12" :disabled="!canSubmit">
      <text class="tracking-wide">Ready, Set, Go! 🚀</text>
    </button>
  </form>
</template>
