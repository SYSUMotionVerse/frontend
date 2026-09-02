<script setup lang="ts">
import type { SessionBadge } from '../../features/growth/summary'

defineProps<{
  badges: SessionBadge[]
}>()

function badgeScore(scoreLabel: string) {
  const score = Number.parseInt(scoreLabel, 10)
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
}
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
        <view class="session-badge__topline">
          <view class="session-badge__chart" aria-label="本次质量得分">
            <view class="session-badge__chart-track">
              <view
                class="session-badge__chart-fill"
                :class="`session-badge__chart-fill--${badge.level}`"
                :style="{ height: `${badgeScore(badge.scoreLabel)}%` }"
              />
            </view>
            <view class="session-badge__chart-copy">
              <text class="session-badge__chart-value">{{ badgeScore(badge.scoreLabel) }}</text>
              <text class="session-badge__chart-unit">质量分</text>
            </view>
          </view>

          <view class="session-badge__body">
            <text class="session-badge__title">{{ badge.title }}</text>
            <text class="session-badge__meta">{{ badge.modalityLabel }}</text>
            <text class="session-badge__count">累计获得 {{ badge.earnedCount }} 次</text>
          </view>
        </view>

        <view class="session-badge__footer">
          <text class="session-badge__description">{{ badge.description }}</text>
          <button
            class="session-badge__share"
            type="button"
            open-type="share"
            :data-share-title="badge.shareTitle"
            :data-share-path="badge.sharePath"
          >
            <text>分享</text>
          </button>
        </view>
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
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.session-badges__title {
  display: block;
  margin-top: 6rpx;
  color: #1A202C;
  font-size: 32rpx;
  font-weight: 900;
}

.session-badges__hint {
  color: #64748B;
  font-size: 21rpx;
  letter-spacing: 0;
  text-align: right;
}

.session-badges__rail {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding-bottom: 8rpx;
}

.session-badge {
  flex: 0 0 336rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 28rpx;
  border: 2rpx solid rgba(255, 211, 132, 0.26);
  background: #fffaf2;
  box-shadow: 0 8rpx 18rpx rgba(71, 56, 39, 0.05);
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

.session-badge__topline,
.session-badge__chart,
.session-badge__chart-copy,
.session-badge__footer {
  display: flex;
}

.session-badge__topline {
  align-items: center;
  gap: 16rpx;
}

.session-badge__chart {
  width: 88rpx;
  height: 104rpx;
  flex: none;
  align-items: flex-end;
  justify-content: center;
  gap: 8rpx;
  padding: 10rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.72);
  box-sizing: border-box;
}

.session-badge__chart-track {
  position: relative;
  width: 18rpx;
  height: 76rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e7eef3;
}

.session-badge__chart-fill {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  min-height: 4rpx;
  border-radius: inherit;
  background: #ff8b8b;
}

.session-badge__chart-fill--platinum { background: #5aa996; }
.session-badge__chart-fill--gold { background: #d49a42; }
.session-badge__chart-fill--silver { background: #5a9bc8; }
.session-badge__chart-fill--bronze { background: #c76b5b; }

.session-badge__chart-copy {
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}

.session-badge__chart-value {
  color: #203042;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1;
}

.session-badge__chart-unit {
  color: #8a97a8;
  font-size: 16rpx;
  font-weight: 700;
  white-space: nowrap;
}

.session-badge__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 8rpx;
}

.session-badge__title {
  color: #1A202C;
  font-size: 28rpx;
  font-weight: 900;
}

.session-badge__meta {
  color: #2B7CB8;
  font-size: 21rpx;
  font-weight: 900;
}

.session-badge__description,
.session-badges__empty-copy {
  color: #64748B;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.55;
}

.session-badge__footer {
  align-items: flex-end;
  gap: 12rpx;
}

.session-badge__count {
  color: #7a8798;
  font-size: 19rpx;
  font-weight: 700;
}

.session-badge__description {
  display: -webkit-box;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.session-badge__share {
  display: inline-flex;
  min-width: 82rpx;
  min-height: 56rpx;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 9999px;
  background: #1A202C;
  color: #fffaf2;
  padding: 0 18rpx;
  font-size: 21rpx;
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
  font-size: 26rpx;
  font-weight: 900;
}
</style>
