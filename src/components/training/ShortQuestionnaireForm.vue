<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  getRatingOptionClasses,
  type RatingOptionPalette
} from '../../features/questionnaire/ratingOptionStyles'

const emit = defineEmits<{
  submit: [payload: { energyLevel: number; confidence: number; enjoyment: number }]
}>()

const props = withDefaults(defineProps<{
  submitting?: boolean
}>(), {
  submitting: false
})

const form = reactive({
  energyLevel: 0,
  confidence: 0,
  enjoyment: 0
})

const questionSections: Array<{
  field: keyof typeof form
  title: string
  icon: string
  palette: RatingOptionPalette
  cardClass: string
  iconClass: string
}> = [
  {
    field: 'energyLevel',
    title: '精力水平',
    icon: '⚡',
    palette: 'gold',
    cardClass: 'short-questionnaire-form__card--gold',
    iconClass: 'short-questionnaire-form__badge--gold'
  },
  {
    field: 'confidence',
    title: '运动信心',
    icon: '✔',
    palette: 'blue',
    cardClass: 'short-questionnaire-form__card--blue',
    iconClass: 'short-questionnaire-form__badge--blue'
  },
  {
    field: 'enjoyment',
    title: '乐趣感受',
    icon: '❤',
    palette: 'coral',
    cardClass: 'short-questionnaire-form__card--coral',
    iconClass: 'short-questionnaire-form__badge--coral'
  }
]

const isComplete = computed(() => {
  return form.energyLevel > 0 && form.confidence > 0 && form.enjoyment > 0
})

function handleFieldChange(field: keyof typeof form, value: number) {
  form[field] = value
}

function optionClasses(isSelected: boolean, palette: RatingOptionPalette) {
  return getRatingOptionClasses(isSelected, palette)
}
</script>

<template>
  <form class="short-questionnaire-form" @submit.prevent="!props.submitting && emit('submit', { ...form })">
    <view class="short-questionnaire-form__hero bg-white chunky-shadow">
      <view class="short-questionnaire-form__hero-badge">
        <text class="text-[48rpx]">🙂</text>
      </view>
      <text class="short-questionnaire-form__hero-title">训练后打卡</text>
      <text class="short-questionnaire-form__hero-copy">在反馈出现前，记录本次训练的感受。</text>
    </view>

    <view
      v-for="section in questionSections"
      :key="section.field"
      class="short-questionnaire-form__card bg-white chunky-shadow"
      :class="section.cardClass"
    >
      <view class="short-questionnaire-form__prompt">
        <view class="short-questionnaire-form__badge" :class="section.iconClass">
          <text>{{ section.icon }}</text>
        </view>
        <view class="short-questionnaire-form__prompt-copy">
          <text class="short-questionnaire-form__prompt-title">{{ section.title }}</text>
          <text class="short-questionnaire-form__prompt-hint">1 分最低，5 分最高</text>
        </view>
      </view>

      <view class="short-questionnaire-form__options">
        <view
          v-for="val in 5"
          :key="val"
          class="short-questionnaire-form__option"
          @click="handleFieldChange(section.field, val)"
        >
          <view
            class="rating-option rating-option--rounded"
            :class="optionClasses(form[section.field] === val, section.palette)"
          >
            {{ val }}
          </view>
        </view>
      </view>
    </view>

    <view class="short-questionnaire-form__actions">
      <button class="btn-primary" form-type="submit" :disabled="!isComplete || props.submitting">
        <text v-if="!isComplete">请完成全部打卡项</text>
        <text v-else-if="props.submitting">正在保存…</text>
        <text v-else>提交打卡 ✨</text>
      </button>
    </view>
  </form>
</template>

<style scoped>
@import '../../features/questionnaire/ratingOptionStyles.css';

.short-questionnaire-form {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.short-questionnaire-form__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 32rpx;
  border-radius: 36rpx;
  border: 4rpx solid rgba(137, 207, 255, 0.24);
  text-align: center;
}

.short-questionnaire-form__hero-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 9999px;
  background: rgba(137, 207, 255, 0.18);
  border: 4rpx solid rgba(137, 207, 255, 0.24);
}

.short-questionnaire-form__hero-title {
  display: block;
  color: #1A202C;
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 900;
}

.short-questionnaire-form__hero-copy {
  display: block;
  color: #64748B;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.short-questionnaire-form__card {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  padding: 36rpx 32rpx;
  border-radius: 32rpx;
  border: 4rpx solid rgba(255, 234, 194, 0.22);
}

.short-questionnaire-form__card--gold {
  border-color: rgba(255, 211, 132, 0.24);
}

.short-questionnaire-form__card--blue {
  border-color: rgba(137, 207, 255, 0.24);
}

.short-questionnaire-form__card--coral {
  border-color: rgba(255, 139, 139, 0.24);
}

.short-questionnaire-form__prompt {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.short-questionnaire-form__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  flex: none;
  border-radius: 9999px;
  border: 4rpx solid transparent;
  font-size: 30rpx;
}

.short-questionnaire-form__badge--gold {
  color: #D97706;
  background: rgba(255, 211, 132, 0.18);
  border-color: rgba(255, 211, 132, 0.22);
}

.short-questionnaire-form__badge--blue {
  color: #2563EB;
  background: rgba(137, 207, 255, 0.18);
  border-color: rgba(137, 207, 255, 0.22);
}

.short-questionnaire-form__badge--coral {
  color: #E11D48;
  background: rgba(255, 139, 139, 0.18);
  border-color: rgba(255, 139, 139, 0.22);
}

.short-questionnaire-form__prompt-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}

.short-questionnaire-form__prompt-title {
  display: block;
  color: #1A202C;
  font-size: 36rpx;
  line-height: 1.2;
  font-weight: 900;
}

.short-questionnaire-form__prompt-hint {
  display: block;
  color: #94A3B8;
  font-size: 24rpx;
  line-height: 1.4;
  font-weight: 700;
}

.short-questionnaire-form__options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.short-questionnaire-form__option {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  justify-content: center;
}

.short-questionnaire-form__actions {
  margin-top: 20rpx;
  padding-bottom: 72rpx;
}
</style>
