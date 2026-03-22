import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig(() => {
  const isUniRuntime = Boolean(process.env.UNI_PLATFORM)
  const uniModule = uniPlugin as typeof uniPlugin & {
    default?: typeof uniPlugin
  }
  const uni = uniModule.default ?? uniModule

  return {
    plugins: isUniRuntime ? [uni(), UnoCSS()] : [UnoCSS(), Vue()],
    test: {
      environment: 'jsdom',
      globals: true
    }
  }
})
