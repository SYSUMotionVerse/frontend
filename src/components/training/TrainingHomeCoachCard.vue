<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'

const props = defineProps<{
  eyebrow: string
  title: string
  body: string
  footer: string
}>()

const isRecovery = computed(() => props.eyebrow.includes('恢复'))
const displayedTitle = shallowRef(props.title)
const outgoingTitle = shallowRef('')
const quoteRolling = shallowRef(false)
let quoteRollStartTimer: ReturnType<typeof setTimeout> | undefined
let quoteRollCleanupTimer: ReturnType<typeof setTimeout> | undefined

function clearQuoteRollTimers() {
  if (quoteRollStartTimer) clearTimeout(quoteRollStartTimer)
  if (quoteRollCleanupTimer) clearTimeout(quoteRollCleanupTimer)
  quoteRollStartTimer = undefined
  quoteRollCleanupTimer = undefined
}

watch(() => props.title, (nextTitle) => {
  if (nextTitle === displayedTitle.value) return
  clearQuoteRollTimers()
  outgoingTitle.value = displayedTitle.value
  displayedTitle.value = nextTitle
  quoteRolling.value = false
  quoteRollStartTimer = setTimeout(() => {
    quoteRolling.value = true
  }, 16)
  quoteRollCleanupTimer = setTimeout(() => {
    outgoingTitle.value = ''
    quoteRolling.value = false
  }, 320)
})

onBeforeUnmount(clearQuoteRollTimers)
</script>

<template>
  <view class="coach-card">
    <view class="coach-card__meta">
      <view class="coach-card__eyebrow-row">
        <uni-icons
          type="fire-filled"
          size="16"
          :color="isRecovery ? '#2b7cb8' : '#e56458'"
        />
        <text
          class="coach-card__eyebrow"
          :class="{ 'coach-card__eyebrow--recovery': isRecovery }"
        >{{ eyebrow }}</text>
      </view>
      <view class="coach-card__title-window">
        <text
          v-if="outgoingTitle"
          class="coach-card__title coach-card__title--outgoing"
          :class="{ 'coach-card__title--rolling': quoteRolling }"
        >{{ outgoingTitle }}</text>
        <text
          class="coach-card__title"
          :class="{
            'coach-card__title--incoming': outgoingTitle,
            'coach-card__title--rolling': quoteRolling
          }"
        >{{ displayedTitle }}</text>
      </view>
    </view>

    <text v-if="body" class="coach-card__body">{{ body }}</text>
    <text class="coach-card__footer">{{ footer }}</text>
  </view>
</template>

<style scoped>
.coach-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 28rpx 30rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.3);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 20rpx rgba(71, 56, 39, 0.04);
}

.coach-card__eyebrow-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.coach-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.coach-card__eyebrow {
  display: block;
  color: #c76b5b;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.coach-card__eyebrow--recovery { color: #203042; }

.coach-card__title {
  grid-area: 1 / 1;
  display: block;
  color: #203042;
  font-size: 27rpx;
  line-height: 1.2;
  font-weight: 800;
}

.coach-card__title-window {
  display: grid;
  overflow: hidden;
}

.coach-card__title--outgoing,
.coach-card__title--incoming {
  transition: opacity 280ms ease, transform 280ms ease;
}

.coach-card__title--incoming {
  opacity: 0;
  transform: translateY(80%);
}

.coach-card__title--outgoing.coach-card__title--rolling {
  opacity: 0;
  transform: translateY(-80%);
}

.coach-card__title--incoming.coach-card__title--rolling {
  opacity: 1;
  transform: translateY(0);
}

.coach-card__body {
  display: block;
  color: #718096;
  font-size: 23rpx;
  line-height: 1.58;
  font-weight: 700;
}

.coach-card__footer {
  display: block;
  padding-top: 12rpx;
  border-top: 2rpx solid rgba(224, 111, 120, 0.1);
  color: #8a97a8;
  font-size: 20rpx;
  line-height: 1.4;
  font-weight: 700;
}
</style>
