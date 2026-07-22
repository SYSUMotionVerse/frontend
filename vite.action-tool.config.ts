import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  publicDir: resolve(__dirname, 'models/pose'),
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
