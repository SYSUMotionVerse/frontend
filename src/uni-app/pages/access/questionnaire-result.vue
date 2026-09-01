<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import QuestionnaireResultCard from '../../../components/access/QuestionnaireResultCard.vue'
import UniAccessPageShell from '../../components/access/UniAccessPageShell.vue'
import { useStudentStore } from '../../composables/useStudentStore'

const store = useStudentStore()
const questionnaireCount = ref(1)

onLoad((query) => {
  const nextQuery = query ?? {}
  questionnaireCount.value = Math.max(1, Number(nextQuery.questionnaireCount ?? 1))
})

function prepareDestination() {
  store.refreshReminderEligibility()
}

function goHome() {
  prepareDestination()
  void uni.reLaunch({
    url: '/pages/training/home'
  })
}

function startTraining() {
  prepareDestination()
  void uni.reLaunch({
    url: '/pages/training/select'
  })
}
</script>

<template>
  <UniAccessPageShell
    navigation-title="填写完成"
    title="问卷填写完成"
    subtitle="谢谢你的认真作答，接下来可以按自己的节奏开始运动。"
    :show-back="false"
    heading-inset
  >
    <QuestionnaireResultCard
      :questionnaire-count="questionnaireCount"
      @home="goHome"
      @train="startTraining"
    />
  </UniAccessPageShell>
</template>
