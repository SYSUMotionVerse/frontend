<script setup lang="ts">
defineProps<{
  chip: string
  title: string
  subtitle: string
}>()
</script>

<template>
  <view class="min-h-screen bg-brand-cream px-6 py-8 text-brand-ink">
    <view class="mx-auto flex max-w-[720px] flex-col gap-6">
      <view class="chip-soft bg-[#FFF5E6] text-[#F59E0B]">
        {{ chip }}
      </view>
      <view class="card-shell flex flex-col gap-3">
        <text class="text-[72rpx] font-black tracking-tight">
          {{ title }}
        </text>
        <text class="text-[44rpx] leading-7 text-slate-600">
          {{ subtitle }}
        </text>
      </view>
      <slot />
    </view>
  </view>
</template>
