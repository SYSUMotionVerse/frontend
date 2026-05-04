<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_AVATAR_URL } from '../../constants/defaultAvatar'
import type { AvatarUploadState } from '../../uni-app/composables/useRegistrationAvatar'

const props = defineProps<{
  avatarUrl: string
  uploadState: AvatarUploadState
  errorMessage: string
  isSourceChooserVisible: boolean
  localAvatarChooserMessage: string
  isWechatMiniProgram: boolean
  supportsWechatAvatarSelection: boolean
}>()

const emit = defineEmits<{
  openSourceChooser: []
  closeSourceChooser: []
  chooseWechatAvatar: [event: { detail?: { avatarUrl?: string } }]
  chooseLocalAvatar: []
}>()

const previewUrl = computed(() => props.avatarUrl.trim() || DEFAULT_AVATAR_URL)
const canChooseWechatAvatar = computed(() =>
  props.isWechatMiniProgram && props.supportsWechatAvatarSelection
)
</script>

<template>
  <button
    class="avatar-field__trigger"
    @click="emit('openSourceChooser')"
  >
    <view class="avatar-field">
      <view class="avatar-field__preview-shell">
        <image
          v-if="previewUrl"
          class="avatar-field__preview-image"
          :src="previewUrl"
          mode="aspectFill"
        />
        <text v-if="props.uploadState === 'uploading'" class="avatar-field__preview-placeholder">
          上传中
        </text>
      </view>
    </view>
  </button>

  <view v-if="props.isSourceChooserVisible" class="avatar-field__source-actions">
    <button
      v-if="canChooseWechatAvatar"
      class="avatar-field__source-action avatar-field__source-action--wechat"
      open-type="chooseAvatar"
      @chooseavatar="emit('chooseWechatAvatar', $event)"
    >
      使用微信头像
    </button>
    <button
      class="avatar-field__source-action avatar-field__source-action--upload"
      @click="emit('chooseLocalAvatar')"
    >
      上传图片
    </button>
    <button
      class="avatar-field__source-action avatar-field__source-action--cancel"
      @click="emit('closeSourceChooser')"
    >
      取消
    </button>
  </view>

  <text v-if="props.isSourceChooserVisible" class="avatar-field__hint block">
    {{ props.localAvatarChooserMessage }}
  </text>

  <text v-if="props.errorMessage" class="avatar-field__message block">
    {{ props.errorMessage }}
  </text>
</template>

<style scoped>
.avatar-field {
  display: flex;
  width: 100%;
  justify-content: center;
}

.avatar-field__trigger {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  text-align: left;
}

.avatar-field__trigger::after {
  border: none;
}

.avatar-field__preview-shell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 132rpx;
  height: 132rpx;
  overflow: hidden;
  flex: none;
  border-radius: 9999px;
  background: #ffffff;
  border: 4rpx solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 10rpx 0 rgba(0, 0, 0, 0.05);
}

.avatar-field__source-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.avatar-field__source-action {
  width: 100%;
  border-radius: 9999px;
  padding: 22rpx 28rpx;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  background: #ffffff;
  color: #1A202C;
}

.avatar-field__source-action::after {
  border-radius: 9999px;
  border: 2rpx solid rgba(15, 23, 42, 0.08);
}

.avatar-field__source-action--wechat {
  background: #ECFCCB;
  color: #166534;
}

.avatar-field__source-action--upload {
  background: #FEF3C7;
  color: #92400E;
}

.avatar-field__source-action--cancel {
  background: #F8FAFC;
  color: #475569;
}

.avatar-field__hint {
  margin-top: 16rpx;
  color: #475569;
  font-size: 24rpx;
  line-height: 1.45;
  text-align: center;
  font-weight: 700;
}

.avatar-field__preview-image {
  width: 100%;
  height: 100%;
}

.avatar-field__preview-placeholder {
  padding: 0 18rpx;
  color: #B45309;
  font-size: 24rpx;
  line-height: 1.35;
  font-weight: 900;
  text-align: center;
}

.avatar-field__message {
  margin-top: 16rpx;
  color: #92400E;
  font-size: 24rpx;
  line-height: 1.45;
  text-align: center;
  font-weight: 700;
}
</style>
