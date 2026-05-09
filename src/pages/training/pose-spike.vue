<script setup lang="ts">
/**
 * pose-spike — BlazePose-Lite integration spike page.
 *
 * Goals (per Cindy):
 *  - Independent page, no changes to existing training flows
 *  - Show 4 real-time stats: loadMs / warmMs / inferMs / fps
 *  - Status field: initializing / ready / detecting / failed
 *
 * Latency is measured in-component (see PoseDetectionView) and
 * surfaced here via the onStats callback.
 */
import { onMounted, ref } from 'vue';
import PoseDetectionView from '../../uni-app/components/pose/PoseDetectionView.vue';
import type { DetectResult } from '../../uni-app/components/pose/PoseDetectModel';

const status = ref('initializing');
const loadMs = ref(0);
const warmMs = ref(0);
const inferMs = ref(0);
const fps = ref(0);
const lastPose = ref<DetectResult | null>(null);

function onStats(stats: {
  status: string;
  loadMs: number;
  warmMs: number;
  inferMs: number;
  fps: number;
}) {
  status.value = stats.status;
  loadMs.value = stats.loadMs;
  warmMs.value = stats.warmMs;
  inferMs.value = stats.inferMs;
  fps.value = stats.fps;
}

function onResult(result: DetectResult) {
  lastPose.value = result;
}

const statusLabel: Record<string, string> = {
  initializing: '初始化中',
  ready: '已就绪',
  detecting: '检测中',
  failed: '失败',
};

const statusColor: Record<string, string> = {
  initializing: 'text-yellow-500',
  ready: 'text-green-500',
  detecting: 'text-blue-500',
  failed: 'text-red-500',
};
</script>

<template>
  <view class="spike-shell">
    <!-- Camera + detection view (full-screen) -->
    <PoseDetectionView
      :on-stats="onStats"
      :on-result="onResult"
    />

    <!-- Stats overlay — top-left corner -->
    <view class="stats-panel">
      <view class="stats-row">
        <text class="stats-label">状态</text>
        <text :class="['stats-value', statusColor[status] ?? '']">
          {{ statusLabel[status] ?? status }}
        </text>
      </view>
      <view class="stats-row">
        <text class="stats-label">load</text>
        <text class="stats-value">{{ loadMs }}ms</text>
      </view>
      <view class="stats-row">
        <text class="stats-label">warm</text>
        <text class="stats-value">{{ warmMs }}ms</text>
      </view>
      <view class="stats-row">
        <text class="stats-label">infer</text>
        <text class="stats-value">{{ inferMs }}ms</text>
      </view>
      <view class="stats-row">
        <text class="stats-label">FPS</text>
        <text class="stats-value">{{ fps }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.spike-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
}
.stats-panel {
  position: absolute;
  top: 0;
  left: 0;
  padding: 24rpx;
  background: rgba(0, 0, 0, 0.6);
  border-bottom-right-radius: 24rpx;
}
.stats-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-bottom: 8rpx;
}
.stats-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
  min-width: 80rpx;
}
.stats-value {
  font-size: 22rpx;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
</style>