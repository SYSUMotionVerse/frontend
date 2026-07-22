<script setup lang="ts">
defineOptions({ name: 'UniIcons' })

defineProps<{
  type?: string
  color?: string
  size?: string | number
}>()
</script>

<template>
  <text class="uni-icons-stub" aria-hidden="true" />
</template>
