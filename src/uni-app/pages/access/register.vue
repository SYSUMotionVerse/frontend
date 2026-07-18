<script setup lang="ts">
import RegistrationForm from '../../../components/access/RegistrationForm.vue'
import type { StudentProfile } from '../../../domain/student/types'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

type RegistrationPayload = Omit<StudentProfile, 'completed'>

const store = useStudentStore()

async function handleSubmit(payload: RegistrationPayload) {
  const completedProfile = {
    ...payload,
    completed: true
  }

  try {
    const result = await studentBackendSync.syncRegistration(completedProfile)
    if (!result.synced) {
      return
    }
  } catch (error) {
    reportBackendSyncError('资料同步', error)
    return
  }

  store.completeProfile(completedProfile)
  store.setActiveCheckpoint('baseline')
  void uni.redirectTo({
    url: '/pages/access/questionnaire?checkpoint=baseline'
  })
}
</script>

<template>
  <UniAccessPageShell
    chip="A1"
    title="注册"
    subtitle="请先完善个人信息，注册完成后才能解锁训练。"
  >
    <RegistrationForm @submit="handleSubmit" />
  </UniAccessPageShell>
</template>
