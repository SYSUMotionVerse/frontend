<script setup lang="ts">
import type { SessionBadge } from '../../features/growth/summary'

defineProps<{
  badges: SessionBadge[]
}>()
</script>

<template>
  <view class="session-badges" aria-label="训练徽章">
    <view class="session-badges__head">
      <view>
        <text class="session-badges__eyebrow">可分享徽章</text>
        <text class="session-badges__title">最近获得</text>
      </view>
      <text class="session-badges__hint">分享给同学一起打卡</text>
    </view>

    <view v-if="badges.length > 0" class="session-badges__rail">
      <view
        v-for="badge in badges"
        :key="badge.id"
        :class="['session-badge', `session-badge--${badge.level}`]"
      >
        <view class="session-badge__svg" :class="`session-badge__svg--${badge.svgName}`">
          <view class="session-badge__svg-ring" />
          <text class="session-badge__svg-mark">
            {{ badge.svgName === 'full-power' ? '冠' : badge.svgName === 'stable-star' ? '星' : badge.svgName === 'rhythm-spark' ? '火' : '芽' }}
          </text>
        </view>

        <view class="session-badge__body">
          <text class="session-badge__title">{{ badge.title }}</text>
          <text class="session-badge__meta">{{ badge.modalityLabel }} · {{ badge.scoreLabel }}</text>
          <text class="session-badge__description">{{ badge.description }}</text>
        </view>

        <button
          class="session-badge__share"
          type="button"
          open-type="share"
          :data-share-title="badge.shareTitle"
          :data-share-path="badge.sharePath"
        >
          <text>分享徽章</text>
        </button>
      </view>
    </view>

    <view v-else class="session-badges__empty">
      <text class="session-badges__empty-title">完成一次训练后生成徽章</text>
      <text class="session-badges__empty-copy">徽章会记录分数、训练类型，并支持转发给好友。</text>
    </view>
  </view>
</template>

<style scoped>
.session-badges {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 14rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid rgba(226, 232, 240, 0.86);
}

.session-badges__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
}

.session-badges__eyebrow,
.session-badges__hint {
  display: block;
  color: #2B7CB8;
  font-size: 19rpx;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.session-badges__title {
  display: block;
  margin-top: 6rpx;
  color: #1A202C;
  font-size: 29rpx;
  font-weight: 900;
}

.session-badges__hint {
  color: #64748B;
  font-size: 18rpx;
  letter-spacing: 0;
  text-align: right;
}

.session-badges__rail {
  display: flex;
  gap: 24rpx;
  overflow-x: auto;
  padding-bottom: 8rpx;
}

.session-badge {
  flex: 0 0 420rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 28rpx;
  border-radius: 40rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.92);
  background: #fffaf2;
  box-shadow: 0 10rpx 0 rgba(0, 0, 0, 0.05);
}

.session-badge--platinum {
  background: linear-gradient(145deg, #f5fbff 0%, #fff6df 100%);
}

.session-badge--gold {
  background: linear-gradient(145deg, #fff7db 0%, #fffaf2 100%);
}

.session-badge--silver {
  background: linear-gradient(145deg, #f3f8ff 0%, #fffaf2 100%);
}

.session-badge--bronze {
  background: linear-gradient(145deg, #fff0df 0%, #fffaf2 100%);
}

.session-badge__svg {
  position: relative;
  display: inline-flex;
  width: 132rpx;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  border-radius: 38rpx;
  overflow: hidden;
}

.session-badge__svg--full-power {
  background: linear-gradient(145deg, #89d6ff 0%, #ffd384 100%);
}

.session-badge__svg--stable-star {
  background: linear-gradient(145deg, #ffd384 0%, #ffad88 100%);
}

.session-badge__svg--rhythm-spark {
  background: linear-gradient(145deg, #a8e6cf 0%, #89d6ff 100%);
}

.session-badge__svg--steady-seed {
  background: linear-gradient(145deg, #d9b38c 0%, #a8e6cf 100%);
}

.session-badge__svg-ring {
  position: absolute;
  inset: 20rpx;
  border: 8rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 9999px;
}

.session-badge__svg-mark {
  position: relative;
  z-index: 1;
  color: #1A202C;
  font-size: 46rpx;
  font-weight: 900;
}

.session-badge__body {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.session-badge__title {
  color: #1A202C;
  font-size: 34rpx;
  font-weight: 900;
}

.session-badge__meta {
  color: #2B7CB8;
  font-size: 24rpx;
  font-weight: 900;
}

.session-badge__description,
.session-badges__empty-copy {
  color: #64748B;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.55;
}

.session-badge__share {
  display: inline-flex;
  min-height: 72rpx;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 9999px;
  background: #1A202C;
  color: #fffaf2;
  font-size: 25rpx;
  font-weight: 900;
}

.session-badge__share::after {
  display: none;
}

.session-badges__empty {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(241, 245, 249, 0.66);
}

.session-badges__empty-title {
  color: #1A202C;
  font-size: 24rpx;
  font-weight: 900;
}
</style>
