<script setup lang="ts">
import { IMMERSIVE_NAVIGATION_LAYOUT_COMPAT_VERSION } from './composables/useImmersiveNavigationLayout'
</script>

<template>
  <view
    class="min-h-screen bg-brand-cream text-brand-ink"
    :data-navigation-layout="IMMERSIVE_NAVIGATION_LAYOUT_COMPAT_VERSION"
  >
    <slot />
  </view>
</template>
