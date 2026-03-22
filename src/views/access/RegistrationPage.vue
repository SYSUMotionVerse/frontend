<script setup lang="ts">
import { useRouter } from 'vue-router'
import AccessPageShell from '../../components/access/AccessPageShell.vue'
import RegistrationForm from '../../components/access/RegistrationForm.vue'
import { useStudentAppState } from '../../composables/useStudentAppState'

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

const router = useRouter()
const { completeProfile, setActiveCheckpoint } = useStudentAppState()

function handleSubmit(payload: RegistrationPayload) {
  completeProfile({
    ...payload,
    completed: true
  })
  setActiveCheckpoint('baseline')
  void router.push('/questionnaires/baseline')
}
</script>

<template>
  <AccessPageShell
    chip="A1"
    title="Registration"
    subtitle="Complete your profile first. Training is locked until registration is complete."
  >
    <RegistrationForm @submit="handleSubmit" />
  </AccessPageShell>
</template>
