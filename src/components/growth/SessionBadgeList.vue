<script setup lang="ts">
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import type { SessionBadge } from '../../features/growth/summary'

defineProps<{
  badges: SessionBadge[]
}>()

const badgeIconColors: Record<SessionBadge['level'], string> = {
  platinum: '#397565',
  gold: '#a76c1c',
  silver: '#2b7cb8',
  bronze: '#c76b5b'
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
        class="session-badge"
      >
        <view class="session-badge__summary">
          <view :class="['session-badge__icon', `session-badge__icon--${badge.level}`]">
            <uni-icons type="medal-filled" size="24" :color="badgeIconColors[badge.level]" />
          </view>
          <view class="session-badge__heading">
            <text class="session-badge__title">{{ badge.title }}</text>
            <text class="session-badge__count">累计 {{ badge.earnedCount }} 次</text>
          </view>
        </view>

        <text class="session-badge__description">{{ badge.description }}</text>

        <button
          class="session-badge__share"
          type="button"
          open-type="share"
          aria-label="分享徽章"
          :data-share-title="badge.shareTitle"
          :data-share-path="badge.sharePath"
        >
          <uni-icons type="redo" size="18" color="#718096" />
        </button>
      </view>
    </view>

    <view v-else class="session-badges__empty">
      <view class="session-badges__empty-icon">
        <uni-icons type="medal-filled" size="22" color="#8a97a8" />
      </view>
      <view class="session-badges__empty-copy-group">
        <text class="session-badges__empty-title">完成一次训练后生成徽章</text>
        <text class="session-badges__empty-copy">徽章会记录你的阶段成果，并支持转发给好友。</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.session-badges,
.session-badges__rail,
.session-badge,
.session-badge__summary,
.session-badge__heading,
.session-badges__empty,
.session-badges__empty-copy-group {
  display: flex;
}

.session-badges {
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
  color: #2b7cb8;
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.session-badges__title {
  display: block;
  margin-top: 6rpx;
  color: #1a202c;
  font-size: 32rpx;
  font-weight: 900;
}

.session-badges__hint {
  color: #64748b;
  font-size: 21rpx;
  letter-spacing: 0;
  text-align: right;
}

.session-badges__rail {
  gap: 14rpx;
  overflow-x: auto;
  padding: 2rpx 2rpx 8rpx;
}

.session-badge {
  position: relative;
  flex: 0 0 318rpx;
  align-items: stretch;
  flex-direction: column;
  gap: 14rpx;
  padding: 20rpx;
  border: 0;
  border-radius: 24rpx;
  background: #fcf7f0;
  box-shadow: none;
  box-sizing: border-box;
}

.session-badge__icon,
.session-badges__empty-icon {
  display: inline-flex;
  width: 58rpx;
  height: 58rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
}

.session-badge__icon--platinum { background: #e4f2ed; }
.session-badge__icon--gold { background: #fff1cf; }
.session-badge__icon--silver { background: #e0f1f8; }
.session-badge__icon--bronze { background: #ffe8e5; }

.session-badge__summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14rpx;
  padding-right: 34rpx;
}

.session-badge__heading {
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 5rpx;
}

.session-badge__title {
  color: #1a202c;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1.25;
}

.session-badge__count {
  color: #c76b5b;
  font-size: 19rpx;
  font-weight: 800;
}

.session-badge__description,
.session-badges__empty-copy {
  color: #718096;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.45;
}

.session-badge__description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.session-badge__share {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  display: inline-flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1;
}

.session-badge__share::after { display: none; }

.session-badges__empty {
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: #fcf7f0;
}

.session-badges__empty-icon { background: #eef3f6; }

.session-badges__empty-copy-group {
  flex-direction: column;
  gap: 6rpx;
}

.session-badges__empty-title {
  color: #1a202c;
  font-size: 25rpx;
  font-weight: 900;
}
</style>
