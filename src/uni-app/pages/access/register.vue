<script setup lang="ts">
import RegistrationForm from '../../../components/access/RegistrationForm.vue'
import type { StudentProfile } from '../../../domain/student/types'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

type RegistrationPayload = Omit<StudentProfile, 'completed'>

const store = useStudentStore()

function handleSubmit(payload: RegistrationPayload) {
  store.completeProfile({
    ...payload,
    completed: true
  })
  store.setActiveCheckpoint('baseline')
  void uni.redirectTo({
    url: '/pages/access/questionnaire?checkpoint=baseline'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A1"
    title="Registration"
    subtitle="Complete your profile first. Training is locked until registration is complete."
  >
    <RegistrationForm @submit="handleSubmit" />
  </UniAccessPageShell>
</template>
