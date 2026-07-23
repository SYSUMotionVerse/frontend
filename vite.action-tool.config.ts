import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  // The prepare script downloads the ignored model cache before Vite starts.
  publicDir: existsSync(resolve(__dirname, '.tmp/action-tool-models'))
    ? resolve(__dirname, '.tmp/action-tool-models')
    : false,
  server: {
    host: '127.0.0.1',
    port: 4174
  },
  build: {
    outDir: 'dist/action-tool',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'action-tool.html')
    }
  }
})
