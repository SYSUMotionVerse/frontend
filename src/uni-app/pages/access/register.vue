<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import RegistrationForm from '../../../components/access/RegistrationForm.vue'
import type { StudentProfile } from '../../../domain/student/types'
import { studentBackendSync } from '../../api/studentBackend'
import { reportBackendSyncError } from '../../api/reportBackendSyncError'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

type RegistrationPayload = Omit<StudentProfile, 'completed'>

const store = useStudentStore()
const isSubmitting = shallowRef(false)
const errorMessage = shallowRef('')
const submitLabel = computed(() => errorMessage.value ? '重新提交' : '准备好了，出发！ 🚀')

async function handleSubmit(payload: RegistrationPayload) {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  const completedProfile = {
    ...payload,
    completed: true
  }

  try {
    const result = await studentBackendSync.syncRegistration(completedProfile)
    if (!result.synced) {
      errorMessage.value = '资料提交失败，请检查网络后重新提交。'
      return
    }
  } catch (error) {
    reportBackendSyncError('资料同步', error)
    errorMessage.value = '资料提交失败，请检查网络后重新提交。'
    return
  } finally {
    isSubmitting.value = false
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
    navigation-title="注册"
    title="注册"
    subtitle="请先完善个人信息，注册完成后才能解锁训练。"
  >
    <RegistrationForm
      :submitting="isSubmitting"
      :submit-label="submitLabel"
      @submit="handleSubmit"
    />
    <view v-if="errorMessage" class="access-submit-error" aria-live="polite">
      <text>{{ errorMessage }}</text>
    </view>
  </UniAccessPageShell>
</template>

<style scoped>
.access-submit-error {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border: 2rpx solid rgba(199, 107, 91, 0.32);
  border-radius: 24rpx;
  background: rgba(255, 232, 229, 0.72);
  color: #8f3f36;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.5;
}
</style>
