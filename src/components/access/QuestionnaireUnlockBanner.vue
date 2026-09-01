<script setup lang="ts">
defineProps<{
  compact?: boolean
}>()

const emit = defineEmits<{
  continueQuestionnaire: []
}>()
</script>

<template>
  <view
    class="questionnaire-unlock"
    :class="{ 'questionnaire-unlock--compact': compact }"
  >
    <view class="questionnaire-unlock__copy">
      <text class="questionnaire-unlock__eyebrow">预览模式</text>
      <text class="questionnaire-unlock__title">先逛一逛，完成问卷后就能开练</text>
      <text v-if="!compact" class="questionnaire-unlock__description">
        你可以先浏览训练项目和成长内容。填写完问卷后，就能开始训练并查看自己的成长记录。
      </text>
    </view>
    <button
      class="questionnaire-unlock__action"
      type="button"
      @click="emit('continueQuestionnaire')"
    >
      去完成问卷
    </button>
  </view>
</template>

<style scoped>
.questionnaire-unlock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  border: 2rpx solid rgba(40, 118, 106, 0.22);
  border-radius: 28rpx;
  background: #e7f0ed;
  padding: 28rpx 30rpx;
}

.questionnaire-unlock--compact {
  align-items: flex-start;
  flex-direction: column;
}

.questionnaire-unlock__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.questionnaire-unlock__eyebrow {
  color: #28766a;
  font-size: 21rpx;
  font-weight: 900;
}

.questionnaire-unlock__title {
  margin-top: 8rpx;
  color: #20344f;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.4;
}

.questionnaire-unlock__description {
  margin-top: 8rpx;
  color: #53635f;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.5;
}

.questionnaire-unlock__action {
  display: inline-flex;
  min-height: 72rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 0;
  border-radius: 999rpx;
  background: #fffaf4;
  color: #28766a;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.2;
  padding: 0 24rpx;
}

.questionnaire-unlock__action::after {
  border: none;
}
</style>
