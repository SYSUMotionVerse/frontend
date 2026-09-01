<script setup lang="ts">
defineProps<{
  canContinue: boolean
  canGoBack: boolean
  lastQuestion: boolean
  submitting: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  previous: []
  next: []
  submit: []
}>()
</script>

<template>
  <view class="questionnaire-runner__footer">
    <view class="questionnaire-runner__actions">
      <button
        class="questionnaire-runner__navigation-button questionnaire-runner__navigation-button--secondary"
        :class="{ 'questionnaire-runner__navigation-button--disabled': !canGoBack }"
        type="button"
        :disabled="!canGoBack"
        @click="emit('previous')"
      >
        <text>上一题</text>
      </button>
      <button
        v-if="!lastQuestion"
        class="questionnaire-runner__navigation-button questionnaire-runner__navigation-button--secondary questionnaire-runner__primary"
        :class="{ 'questionnaire-runner__navigation-button--disabled': !canContinue }"
        type="button"
        :disabled="!canContinue"
        @click="emit('next')"
      >
        <text>下一题</text>
      </button>
      <button
        v-else
        class="questionnaire-runner__navigation-button questionnaire-runner__navigation-button--submit questionnaire-runner__primary"
        :class="{ 'questionnaire-runner__navigation-button--submit-disabled': !canContinue || submitting }"
        type="button"
        :disabled="!canContinue || submitting"
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
  padding: 0;
}

.questionnaire-runner__actions {
  display: flex;
  gap: 30rpx;
  padding: 0 10rpx;
}

.questionnaire-runner__navigation-button {
  height: 88rpx;
  min-width: 0;
  flex: 1;
  margin: 0;
  padding: 0 16rpx;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 88rpx;
  text-align: center;
}

.questionnaire-runner__navigation-button::after {
  border: none;
}

.questionnaire-runner__navigation-button--secondary {
  border: 2rpx solid #ff8b7b;
  background: rgba(255, 250, 244, 0.68);
  color: #ff6f62;
}

.questionnaire-runner__navigation-button--disabled {
  border-color: rgba(113, 128, 150, 0.2);
  background: rgba(248, 250, 252, 0.76);
  color: rgba(113, 128, 150, 0.46);
}

.questionnaire-runner__navigation-button--submit {
  border: 0;
  background: #ff8b8b;
  box-shadow: 0 10rpx 0 #de7272;
  color: #1a202c;
}

.questionnaire-runner__navigation-button--submit:active {
  box-shadow: 0 4rpx 0 #DE7272;
}

.questionnaire-runner__navigation-button--submit-disabled {
  background: rgba(203, 213, 225, 0.72);
  box-shadow: none;
  color: rgba(71, 85, 105, 0.52);
}
</style>
