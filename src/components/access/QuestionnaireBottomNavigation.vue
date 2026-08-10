<script setup lang="ts">
defineProps<{
  canContinue: boolean
  lastQuestion: boolean
  submitting: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  next: []
  submit: []
}>()
</script>

<template>
  <view v-if="canContinue" class="questionnaire-runner__footer">
    <view class="questionnaire-runner__actions">
      <button
        v-if="!lastQuestion"
        class="questionnaire-runner__primary btn-primary"
        type="button"
        @click="emit('next')"
      >
        <text>下一题</text>
      </button>
      <button
        v-else
        class="questionnaire-runner__primary btn-primary"
        type="button"
        :disabled="submitting"
        @click="emit('submit')"
      >
        <text>
          {{ submitting ? '正在提交…' : submitLabel }}
        </text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.questionnaire-runner__footer {
  position: relative;
  z-index: 0;
  isolation: isolate;
  margin-top: 24rpx;
  padding: 0 0 80rpx;
}

.questionnaire-runner__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.questionnaire-runner__primary {
  width: 100%;
  margin: 0;
  background: #FF8B8B;
  box-shadow: 0 10rpx 0 #DE7272;
  color: #1A202C;
}

.questionnaire-runner__primary::after {
  border: none;
}

.questionnaire-runner__primary:active {
  box-shadow: 0 4rpx 0 #DE7272;
}
</style>
