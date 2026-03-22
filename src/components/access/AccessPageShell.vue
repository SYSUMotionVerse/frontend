<script setup lang="ts">
interface Props {
  title: string
  subtitle: string
  chip?: string
}

defineProps<Props>()
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col px-6 py-6 pb-24">
    <header class="w-full text-center mt-4 mb-8 relative z-10 transition-all">
      <div v-if="chip" class="inline-flex items-center justify-center p-2 px-4 rounded-full bg-[#E0EDFF] border-[3px] border-[#D1E8FF] shadow-sm mb-4">
        <text class="text-[20px] font-black uppercase tracking-widest text-[#4A90E2]">{{ chip }}</text>
      </div>
      <div v-else class="inline-flex items-center justify-center w-[72px] h-[72px] bg-[#FFD384] rounded-full mb-4 shadow-sm border-[4px] border-white">
        <text class="text-3xl animate-bounce" style="animation-duration: 2s;">🏃‍♂️</text>
      </div>
      
      <h1 class="text-[42px] font-black text-[#1A202C] tracking-tight leading-none mb-4 drop-shadow-[0_2px_0_rgba(0,0,0,0.05)]">{{ title }}</h1>
      <p class="text-[#64748B] text-[24px] font-bold italic px-4 leading-snug">{{ subtitle }}</p>
    </header>

    <div class="w-full relative z-10">
      <slot />
    </div>
    
    <!-- Floating background decorative blobs -->
    <div class="fixed -bottom-16 -left-16 w-80 h-80 bg-[#FFD384]/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
    <div class="fixed top-1/4 -right-24 w-80 h-80 bg-[#89CFFF]/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
  </main>
</template>
