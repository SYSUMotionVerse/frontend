<template>
  <view class="growth-shell">
    <slot />
  </view>
</template>

<style scoped>
.growth-shell {
  margin: 0 auto;
  width: min(880px, 100%);
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
}
</style>
