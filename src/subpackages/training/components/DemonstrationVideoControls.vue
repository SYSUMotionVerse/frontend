<script setup lang="ts">
import { computed } from 'vue'

const playbackRates = [0.5, 0.8, 1, 1.25, 1.5] as const

const props = withDefaults(defineProps<{
  playbackRate: number
  compact?: boolean
}>(), {
  compact: false
})

const emit = defineEmits<{
  replay: []
  changePlaybackRate: [rate: number]
}>()

const speedLabel = computed(() => `${props.playbackRate}×`)

function cyclePlaybackRate() {
  const currentIndex = playbackRates.findIndex(rate => rate === props.playbackRate)
  const nextIndex = currentIndex < 0
    ? playbackRates.indexOf(1)
    : (currentIndex + 1) % playbackRates.length
  emit('changePlaybackRate', playbackRates[nextIndex])
}
</script>

<template>
  <cover-view
    class="demonstration-video-controls"
    :class="{ 'demonstration-video-controls--compact': compact }"
    aria-label="演示视频快捷操作"
  >
    <cover-view
      class="demonstration-video-controls__button demonstration-video-controls__button--replay"
      aria-label="重放演示"
      @tap.stop="emit('replay')"
    >
      <text class="demonstration-video-controls__replay-icon" aria-hidden="true">↺</text>
    </cover-view>
    <cover-view
      class="demonstration-video-controls__button demonstration-video-controls__button--speed"
      :aria-label="`切换倍速，当前 ${speedLabel}`"
      @tap.stop="cyclePlaybackRate"
    >
      {{ speedLabel }}
    </cover-view>
  </cover-view>
</template>

<style scoped>
.demonstration-video-controls {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.demonstration-video-controls__button {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  color: #fffaf4;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}

.demonstration-video-controls__replay-icon {
  font-size: 34rpx;
  font-weight: 400;
  line-height: 1;
}

.demonstration-video-controls__button--speed {
  font-size: 19rpx;
}

.demonstration-video-controls--compact {
  right: 6px;
  top: 6px;
  gap: 6px;
}

.demonstration-video-controls--compact .demonstration-video-controls__button {
  width: 32px;
  height: 32px;
  font-size: 11px;
}

.demonstration-video-controls--compact .demonstration-video-controls__replay-icon {
  font-size: 20px;
}
</style>
